import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";
import { getCurrentGarageId } from "@/lib/actions/garage";
import { createClient } from "@/lib/supabase/server";
import { recordAiUsage, isFeatureEnabledForGarage } from "@/lib/actions/admin";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { checkAiQuota } from "@/lib/ai/quota";
import { logAiEvent } from "@/lib/ai/ai-events";
import { safeAiCall } from "@/lib/ai/safe-ai";
import type { ClientMessageResponse, ClientMessageTemplate } from "@/lib/ai/client-message-types";

const FALLBACK_MESSAGE = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
const TEMPLATES: ClientMessageTemplate[] = [
  "relance_j2",
  "relance_j7",
  "demande_accord",
  "vehicule_pret",
  "demande_infos",
];
const ClientMessageInputSchema = z.object({
  template: z.enum(["relance_j2", "relance_j7", "demande_accord", "vehicule_pret", "demande_infos"]),
  clientName: z.string().min(1),
  vehicleLabel: z.string().optional(),
  quoteRef: z.string().optional(),
  totalTtc: z.number().optional(),
  validUntil: z.string().nullable().optional(),
});

const ClientMessageResponseSchema = z.object({
  subject: z.string(),
  body: z.string(),
  sms: z.string(),
});

function buildUserMessage(body: {
  template: ClientMessageTemplate;
  clientName: string;
  vehicleLabel?: string;
  quoteRef?: string;
  totalTtc?: number;
  validUntil?: string | null;
}): string {
  const parts: string[] = [
    `Template demandé : ${body.template}`,
    `Nom du client : ${body.clientName}`,
  ];
  if (body.vehicleLabel?.trim()) parts.push(`Véhicule : ${body.vehicleLabel.trim()}`);
  if (body.quoteRef?.trim()) parts.push(`Référence devis : ${body.quoteRef.trim()}`);
  if (typeof body.totalTtc === "number") parts.push(`Montant TTC : ${body.totalTtc} €`);
  if (body.validUntil?.trim()) parts.push(`Date validité devis : ${body.validUntil.trim()}`);
  return parts.join("\n");
}

const systemPrompt = `Tu es un professionnel de l'automobile qui rédige des messages courts (email et SMS) pour les garagistes à envoyer à leurs clients.

RÈGLES STRICTES :
1. Ton professionnel, courtois, jamais agressif ni insistant.
2. RGPD : n'inclure dans le message que les données strictement nécessaires (ex. prénom/nom, référence devis, montant si pertinent). Pas de phrase sur la conservation des données sauf si vraiment pertinent.
3. Réponse UNIQUEMENT en JSON valide avec exactement ces clés : "subject" (sujet de l'email), "body" (corps de l'email, texte court), "sms" (texte SMS court, sans sujet).

TEMPLATES :
- relance_j2 : Rappel courtois 2 jours après envoi du devis. Inviter le client à prendre connaissance du devis et à nous contacter pour toute question. Pas de pression.
- relance_j7 : Rappel courtois 7 jours après. Même ton. Rappeler la date de validité si fournie.
- demande_accord : Demander au client de confirmer son accord sur le devis (validation). Indiquer la référence et le montant TTC si fournis. Proposer de nous contacter pour valider.
- vehicule_pret : Annoncer que le véhicule est prêt à être récupéré. Courtois et clair.
- demande_infos : Demander un complément d'information au client (sans détail technique inutile). Courtois et professionnel.

Les champs "body" et "sms" doivent être en français, adaptés à un particulier. Le SMS doit rester court (une ou deux phrases si possible).`;

async function tryMistral(userMessage: string): Promise<ClientMessageResponse | { error: string } | null> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  if (!apiKey) return null;
  try {
    const mistral = new Mistral({ apiKey });
    const models = ["mistral-large-latest", "mistral-medium-latest"];
    for (const model of models) {
      try {
        const response = await mistral.chat.complete({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          responseFormat: { type: "json_object" },
          temperature: 0.3,
        });
        const raw = response.choices[0]?.message?.content;
        if (!raw) continue;
        const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((c) => (typeof c === "string" ? c : (c as { text?: string }).text ?? "")).join("") : "";
        if (!content) continue;
        const parsed = JSON.parse(content);
        const validated = ClientMessageResponseSchema.safeParse(parsed);
        if (validated.success) return validated.data;
      } catch {
        if (model === models[models.length - 1]) return { error: "Mistral: erreur" };
      }
    }
    return { error: "Mistral: échec" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return { error: `Mistral: ${msg}` };
  }
}

async function tryGemini(userMessage: string): Promise<ClientMessageResponse | { error: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith("AIza")) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    for (const model of models) {
      try {
        const genModel = genAI.getGenerativeModel({ model });
        const result = await genModel.generateContent({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}\n\nRetourne uniquement le JSON (subject, body, sms).` }] }],
          generationConfig: { temperature: 0.3 },
        });
        let content = result.response.text();
        if (!content) continue;
        content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        const firstBrace = content.indexOf("{");
        const lastBrace = content.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) content = content.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(content);
        const validated = ClientMessageResponseSchema.safeParse(parsed);
        if (validated.success) return validated.data;
      } catch {
        if (model === models[models.length - 1]) return { error: "Gemini: erreur" };
      }
    }
    return { error: "Gemini: échec" };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return { error: `Gemini: ${msg}` };
  }
}

async function tryOpenAI(userMessage: string): Promise<ClientMessageResponse | { error: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith("sk-")) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userMessage}\n\nRetourne uniquement le JSON.` },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) return { error: "OpenAI: pas de contenu" };
    const parsed = JSON.parse(content);
    const validated = ClientMessageResponseSchema.safeParse(parsed);
    if (validated.success) return validated.data;
    return { error: `OpenAI: ${validated.error.message}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    return { error: `OpenAI: ${msg}` };
  }
}

export async function POST(request: NextRequest) {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!checkRateLimit(garageId)) {
      return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
    }
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_client_message");
    if (!featureOk) {
      return NextResponse.json({ error: "Fonctionnalité désactivée pour ce garage." }, { status: 403 });
    }
    const quota = await checkAiQuota(garageId);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Quota IA atteint. Contactez le support ou augmentez votre plan.", quotaExceeded: true },
        { status: 200 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ClientMessageInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides. Vérifiez les champs." }, { status: 400 });
    }
    const { template, clientName, vehicleLabel, quoteRef, totalTtc, validUntil } = parsed.data;

    const userMessage = buildUserMessage({
      template: template as ClientMessageTemplate,
      clientName: clientName.trim(),
      vehicleLabel: vehicleLabel?.trim(),
      quoteRef: quoteRef?.trim(),
      totalTtc,
      validUntil: validUntil ?? undefined,
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const safeResult = await safeAiCall({
      garageId,
      userId,
      feature: "client_message",
      fn: async () => {
        let result: ClientMessageResponse | { error: string } | null = await tryMistral(userMessage);
        if (result && "error" in result) result = await tryGemini(userMessage);
        if (result && "error" in result) result = await tryOpenAI(userMessage);
        return result;
      },
    });

    if (safeResult.error) {
      await logAiEvent(garageId, userId, "client_message", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: safeResult.error }, { status: 200 });
    }
    const result = safeResult.data;
    if (result == null) {
      await logAiEvent(garageId, userId, "client_message", "error", safeResult.latencyMs);
      return NextResponse.json(
        { fallback: true, error: "Aucune API IA configurée. Configurez MISTRAL_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY." },
        { status: 200 }
      );
    }
    if ("error" in result) {
      await logAiEvent(garageId, userId, "client_message", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: FALLBACK_MESSAGE }, { status: 200 });
    }
    await recordAiUsage(garageId);
    await logAiEvent(garageId, userId, "client_message", "success", safeResult.latencyMs);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 200 });
  }
}
