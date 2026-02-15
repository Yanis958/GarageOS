import { NextResponse } from "next/server";
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
import { getInsightsStats } from "@/lib/actions/insights";
import type { InsightsResponse } from "@/lib/ai/insights-types";

const FALLBACK_MESSAGE = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

const InsightItemSchema = z.object({
  title: z.string(),
  why: z.string(),
  impact: z.string(),
  action: z.string(),
});

const InsightsResponseSchema = z.object({
  insights: z.array(InsightItemSchema).max(3),
});

function buildContext(stats: Awaited<ReturnType<typeof getInsightsStats>>): string {
  const parts: string[] = [];
  if (stats.acceptanceRate != null) {
    parts.push(`Taux d'acceptation : ${Math.round(stats.acceptanceRate * 100)} % (${stats.acceptedCount} acceptés / ${stats.acceptedCount + stats.sentCount} envoyés).`);
  } else {
    parts.push("Taux d'acceptation : non calculable (aucun devis envoyé).");
  }
  if (stats.averageBasket != null) {
    parts.push(`Panier moyen (devis acceptés) : ${stats.averageBasket.toFixed(2)} € (sur ${stats.acceptedCount} devis acceptés).`);
  } else {
    parts.push("Panier moyen : aucun devis accepté.");
  }
  parts.push(`CA total accepté : ${stats.totalAcceptedTtc.toFixed(2)} €.`);
  parts.push(`CA estimé (devis en attente, statut envoyé) : ${stats.estimatedCa.toFixed(2)} € (${stats.sentCount} devis en attente).`);
  if (stats.laborHoursEstimated != null && stats.laborHoursEstimated > 0) {
    parts.push(`Heures main d'œuvre estimées (sur devis acceptés) : ${stats.laborHoursEstimated} h.`);
  }
  if (stats.lowMarginItemsCount != null && stats.lowMarginItemsCount > 0) {
    parts.push(`Nombre de lignes avec marge négative ou très faible (< 5 %) : ${stats.lowMarginItemsCount}.`);
  }
  return parts.join(" ");
}

const systemPrompt = `Tu es un assistant business pour un chef de garage automobile. Ton objectif est d'aider à gagner plus : sous-facturation, panier moyen, taux d'acceptation, temps estimé (le temps facturé réel n'est pas en base, tu peux recommander de le suivre).

RÈGLES STRICTES :
1. Utilise UNIQUEMENT les données du contexte fourni. Ne invente JAMAIS de chiffres.
2. Si une métrique manque ou est absente du contexte, ne pas en inventer une ; tu peux recommander de la suivre à l'avenir.
3. Réponse strictement en JSON : { "insights": [ { "title": "...", "why": "...", "impact": "...", "action": "..." } ] }.
4. Maximum 3 recommandations. Chaque insight doit être concret et actionnable.
5. title : titre court. why : explication courte (pourquoi c'est important). impact : impact business. action : action concrète à faire.
6. Réponds en français.`;

export async function GET() {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!checkRateLimit(garageId)) {
      return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
    }
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_insights");
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

    const stats = await getInsightsStats();
    const context = buildContext(stats);
    const userPrompt = `Contexte garage (stats agrégées uniquement) :\n${context}\n\nGénère entre 0 et 3 recommandations business concrètes à partir de ces données. Réponds en JSON uniquement : { "insights": [ { "title": "...", "why": "...", "impact": "...", "action": "..." } ] }.`;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const safeResult = await safeAiCall({
      garageId,
      userId,
      feature: "insights",
      fn: async () => {
        let result: InsightsResponse | { error: string } | null = null;
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
                const validated = InsightsResponseSchema.safeParse(parsed);
                if (validated.success) {
                  result = validated.data;
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
                const validated = InsightsResponseSchema.safeParse(parsed);
                if (validated.success) result = validated.data;
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
                const validated = InsightsResponseSchema.safeParse(parsed);
                if (validated.success) result = validated.data;
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
      await logAiEvent(garageId, userId, "insights", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: safeResult.error }, { status: 200 });
    }
    const result = safeResult.data;
    if (result == null) {
      await logAiEvent(garageId, userId, "insights", "error", safeResult.latencyMs);
      return NextResponse.json(
        { fallback: true, error: "Aucune API IA configurée. Configurez MISTRAL_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY." },
        { status: 200 }
      );
    }
    if ("error" in result) {
      await logAiEvent(garageId, userId, "insights", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: FALLBACK_MESSAGE }, { status: 200 });
    }
    await recordAiUsage(garageId);
    await logAiEvent(garageId, userId, "insights", "success", safeResult.latencyMs);
    return NextResponse.json(result as InsightsResponse);
  } catch {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 200 });
  }
}
