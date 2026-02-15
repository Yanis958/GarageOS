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
import type { QuickNoteSuggestResponse } from "@/lib/ai/quick-note-types";

const FALLBACK_MESSAGE = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
const QuickNoteInputSchema = z.object({
  note: z.string().min(1),
  entityType: z.enum(["client", "vehicle"]).optional(),
  entityId: z.string().optional(),
});

const SuggestedQuoteLineSchema = z.object({
  description: z.string(),
  quantity: z.number().nonnegative(),
  unit_price: z.number().nonnegative(),
  type: z.enum(["labor", "part", "forfait"]),
});

const QuoteLinesSchema = z.object({
  kind: z.literal("quote_lines"),
  lines: z.array(SuggestedQuoteLineSchema).min(1),
});

const TaskSchema = z.object({
  kind: z.literal("task"),
  title: z.string().min(1),
});

const QuickNoteSuggestResponseSchema = z.discriminatedUnion("kind", [
  QuoteLinesSchema,
  TaskSchema,
]);

const systemPrompt = `Tu es un assistant pour un garage automobile. On te donne une note rapide (texte libre ou dictée) liée à un client ou un véhicule.

Ta mission : décider si cette note doit être transformée en lignes de devis (intervention à facturer) ou en une tâche à faire (rappels, RDV, suivi).

RÈGLES :
1. Réponse strictement en JSON avec un seul champ "kind" :
   - Si la note décrit une intervention / prestation / réparation à facturer : réponds { "kind": "quote_lines", "lines": [ { "description": "...", "quantity": number, "unit_price": number (HT), "type": "labor"|"part"|"forfait" }, ... ] }. type labor = main-d'œuvre (quantity en heures), part = pièce, forfait = forfait.
   - Si la note décrit une action à faire (rappeler, prendre RDV, vérifier, etc.) : réponds { "kind": "task", "title": "Titre court de la tâche" }.
2. Pour quote_lines : au moins une ligne, descriptions en français, prix HT réalistes, quantity et unit_price cohérents (total = quantity * unit_price sera calculé côté app).
3. Pour task : title court et actionnable (ex. "Rappeler client pour RDV", "Vérifier dispo pièce").
4. Ne génère que des données à partir de la note ; n'invente pas d'éléments absents.`;

export async function POST(request: NextRequest) {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!checkRateLimit(garageId)) {
      return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
    }
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_quick_note");
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
    const parsed = QuickNoteInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides. Vérifiez les champs." }, { status: 400 });
    }
    const note = parsed.data.note.trim();
    const entityType = parsed.data.entityType === "vehicle" ? "vehicle" : "client";
    const entityId = parsed.data.entityId?.trim() ?? "";

    const userPrompt = `Contexte : entité = ${entityType}, id = ${entityId ? `${entityId.slice(0, 8)}...` : "—"}.\n\nNote :\n${note}\n\nRéponds en JSON uniquement : soit { "kind": "quote_lines", "lines": [ ... ] } soit { "kind": "task", "title": "..." }.`;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const safeResult = await safeAiCall({
      garageId,
      userId,
      feature: "quick_note",
      fn: async () => {
        let result: QuickNoteSuggestResponse | { error: string } | null = null;
        const apiKeyMistral = process.env.MISTRAL_API_KEY?.trim();
        if (apiKeyMistral) {
          try {
            const mistral = new Mistral({ apiKey: apiKeyMistral });
            const models = ["mistral-large-latest", "mistral-medium-latest"];
            for (const model of models) {
              try {
                const response = await mistral.chat.complete({
                  model,
                  messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                  ],
                  responseFormat: { type: "json_object" },
                  temperature: 0.2,
                });
                const content = response.choices[0]?.message?.content;
                if (!content) continue;
                const parsed = JSON.parse(content);
                const validated = QuickNoteSuggestResponseSchema.safeParse(parsed);
                if (validated.success) {
                  result = validated.data as QuickNoteSuggestResponse;
                  break;
                }
              } catch {
                if (model === models[models.length - 1]) result = { error: "Mistral: erreur" };
              }
            }
          } catch (e: unknown) {
            result = { error: e instanceof Error ? e.message : "Mistral erreur" };
          }
        }
        if (!result || "error" in result) {
          const apiKeyGemini = process.env.GEMINI_API_KEY?.trim();
          if (apiKeyGemini?.startsWith("AIza")) {
            try {
              const genAI = new GoogleGenerativeAI(apiKeyGemini);
              const genModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
              const res = await genModel.generateContent({
                contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}\n\nJSON uniquement.` }] }],
                generationConfig: { temperature: 0.2 },
              });
              let content = res.response.text();
              if (content) {
                content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
                const firstBrace = content.indexOf("{");
                const lastBrace = content.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace > firstBrace) content = content.substring(firstBrace, lastBrace + 1);
                const parsed = JSON.parse(content);
                const validated = QuickNoteSuggestResponseSchema.safeParse(parsed);
                if (validated.success) result = validated.data as QuickNoteSuggestResponse;
              }
            } catch {
              // ignore
            }
          }
        }
        if (!result || "error" in result) {
          const apiKeyOpenAI = process.env.OPENAI_API_KEY?.trim();
          if (apiKeyOpenAI?.startsWith("sk-")) {
            try {
              const openai = new OpenAI({ apiKey: apiKeyOpenAI });
              const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                temperature: 0.2,
                response_format: { type: "json_object" },
              });
              const content = completion.choices[0]?.message?.content;
              if (content) {
                const parsed = JSON.parse(content);
                const validated = QuickNoteSuggestResponseSchema.safeParse(parsed);
                if (validated.success) result = validated.data as QuickNoteSuggestResponse;
              }
            } catch {
              // ignore
            }
          }
        }
        return result;
      },
    });

    if (safeResult.error) {
      await logAiEvent(garageId, userId, "quick_note", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: safeResult.error }, { status: 200 });
    }
    const result = safeResult.data;
    if (result == null) {
      await logAiEvent(garageId, userId, "quick_note", "error", safeResult.latencyMs);
      return NextResponse.json(
        { fallback: true, error: "Aucune API IA configurée. Configurez MISTRAL_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY." },
        { status: 200 }
      );
    }
    if ("error" in result) {
      await logAiEvent(garageId, userId, "quick_note", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: FALLBACK_MESSAGE }, { status: 200 });
    }
    await recordAiUsage(garageId);
    await logAiEvent(garageId, userId, "quick_note", "success", safeResult.latencyMs);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 200 });
  }
}
