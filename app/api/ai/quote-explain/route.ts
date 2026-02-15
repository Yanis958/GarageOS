import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";
import { getQuoteById } from "@/lib/actions/quotes";
import { getCurrentGarageId } from "@/lib/actions/garage";
import { createClient } from "@/lib/supabase/server";
import { recordAiUsage, isFeatureEnabledForGarage } from "@/lib/actions/admin";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { checkAiQuota } from "@/lib/ai/quota";
import { logAiEvent } from "@/lib/ai/ai-events";
import { safeAiCall } from "@/lib/ai/safe-ai";
import type { QuoteExplainResponse } from "@/lib/ai/quote-explain-types";

const FALLBACK_MESSAGE = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

const QuoteExplainInputSchema = z.object({
  quoteId: z.string().min(1),
  lines: z.array(z.object({
    description: z.string().optional(),
    quantity: z.number().optional(),
    unit_price: z.number().optional(),
    total: z.number().optional(),
    type: z.string().optional(),
    optional: z.boolean().optional(),
    optional_reason: z.string().optional(),
  })).optional(),
  totalHt: z.number().optional(),
  totalTva: z.number().optional(),
  totalTtc: z.number().optional(),
  durationEstimate: z.string().optional(),
});

const QuoteExplainResponseSchema = z.object({
  short: z.string().min(1),
  detailed: z.array(z.string()).min(1),
  faq: z.array(
    z.object({
      q: z.string(),
      a: z.string(),
    })
  ).min(1),
});

function buildUserMessage(body: {
  lines: Array<{ description?: string; quantity?: number; unit_price?: number; total?: number; type?: string; optional?: boolean; optional_reason?: string }>;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  durationEstimate?: string;
}): string {
  const linesText = body.lines
    .map((l) => {
      const opt = l.optional ? " (optionnel)" : "";
      return `- ${l.description ?? ""} | Qté: ${l.quantity ?? 0} | Prix unit. HT: ${l.unit_price ?? 0} € | Total: ${l.total ?? 0} € | Type: ${l.type ?? "part"}${opt}${l.optional_reason ? ` (${l.optional_reason})` : ""}`;
    })
    .join("\n");
  return [
    "Lignes du devis :",
    linesText,
    "",
    `Total HT: ${body.totalHt} € | TVA: ${body.totalTva} € | Total TTC: ${body.totalTtc} €`,
    body.durationEstimate ? `Durée estimée d'intervention: ${body.durationEstimate}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const systemPrompt = `Tu es un professionnel de l'automobile qui aide les garagistes à expliquer un devis à leur client de façon simple et rassurante.

Ta mission : à partir des données du devis (lignes, totaux, durée), générer une explication en français pour le client final (particulier).

RÈGLES STRICTES :
1. Ton professionnel, simple, humain, non technique. Pas de jargon inutile.
2. Ne fais JAMAIS de promesses techniques impossibles : pas de garanties non prévues, pas de délais fermes non justifiés. Reste factuel.
3. Réponse UNIQUEMENT en JSON valide avec exactement ces clés :
   - "short" : string (version courte, 3 à 5 phrases qui résument le devis de façon rassurante)
   - "detailed" : tableau de strings (version détaillée en bullet points, 4 à 8 points)
   - "faq" : tableau d'objets { "q": string, "a": string } (points rassurants : par ex. "La TVA est-elle incluse ?", "Qu'est-ce qui est optionnel ?", "Quelle est la durée estimée ?"). 3 à 5 questions/réponses courtes.

4. short et detailed doivent expliquer ce qui est inclus, le montant TTC, les options éventuelles, la durée, sans inventer d'éléments absents du devis.
5. Le client doit se sentir rassuré (transparence, TVA incluse, optionnel clairement indiqué).`;

async function tryMistral(userMessage: string): Promise<QuoteExplainResponse | { error: string } | null> {
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
        const content = response.choices[0]?.message?.content;
        if (!content) continue;
        const parsed = JSON.parse(content);
        const validated = QuoteExplainResponseSchema.safeParse(parsed);
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

async function tryGemini(userMessage: string): Promise<QuoteExplainResponse | { error: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || !apiKey.startsWith("AIza")) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];
    for (const model of models) {
      try {
        const genModel = genAI.getGenerativeModel({ model });
        const result = await genModel.generateContent({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userMessage}\n\nRetourne uniquement le JSON (short, detailed, faq), rien d'autre.` }] }],
          generationConfig: { temperature: 0.3 },
        });
        let content = result.response.text();
        if (!content) continue;
        content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
        const firstBrace = content.indexOf("{");
        const lastBrace = content.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) content = content.substring(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(content);
        const validated = QuoteExplainResponseSchema.safeParse(parsed);
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

async function tryOpenAI(userMessage: string): Promise<QuoteExplainResponse | { error: string } | null> {
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
    const validated = QuoteExplainResponseSchema.safeParse(parsed);
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
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_quote_explain");
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
    const parsed = QuoteExplainInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides. Vérifiez les champs." }, { status: 400 });
    }
    const { quoteId, lines: linesInput, totalHt = 0, totalTva = 0, totalTtc = 0, durationEstimate } = parsed.data;

    const quote = await getQuoteById(quoteId);
    if (!quote) {
      return NextResponse.json({ error: "Devis introuvable ou accès refusé" }, { status: 404 });
    }

    let effectiveLines = Array.isArray(linesInput) ? linesInput : [];
    if (effectiveLines.length === 0) {
      const items = (quote as { items?: Array<Record<string, unknown>> }).items ?? [];
      effectiveLines = items.map((it) => ({
        description: String(it.description ?? ""),
        quantity: Number(it.quantity ?? 0),
        unit_price: Number(it.unit_price ?? 0),
        total: Number(it.total ?? 0),
        type: String(it.type ?? "part"),
        optional: !!it.optional,
        optional_reason: it.optional_reason ? String(it.optional_reason) : undefined,
      }));
    }

    const userMessage = buildUserMessage({
      lines: effectiveLines,
      totalHt,
      totalTva,
      totalTtc,
      durationEstimate,
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const safeResult = await safeAiCall({
      garageId,
      userId,
      feature: "quote_explain",
      fn: async () => {
        let result: QuoteExplainResponse | { error: string } | null = await tryMistral(userMessage);
        if (result && "error" in result) result = await tryGemini(userMessage);
        if (result && "error" in result) result = await tryOpenAI(userMessage);
        return result;
      },
    });

    if (safeResult.error) {
      await logAiEvent(garageId, userId, "quote_explain", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: safeResult.error }, { status: 200 });
    }

    const result = safeResult.data;
    if (result == null) {
      await logAiEvent(garageId, userId, "quote_explain", "error", safeResult.latencyMs);
      return NextResponse.json(
        { fallback: true, error: "Aucune API IA configurée. Configurez MISTRAL_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY." },
        { status: 200 }
      );
    }
    if ("error" in result) {
      await logAiEvent(garageId, userId, "quote_explain", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: FALLBACK_MESSAGE }, { status: 200 });
    }

    await recordAiUsage(garageId);
    await logAiEvent(garageId, userId, "quote_explain", "success", safeResult.latencyMs);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 200 });
  }
}
