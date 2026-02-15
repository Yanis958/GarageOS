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
import { getQuoteDurationHours, getPlanningAssignments } from "@/lib/actions/planning";
import { getWeekDays, getMondayOfWeek } from "@/lib/utils/planning";
import type { PlanningSuggestResponse, DailyLoadLevel } from "@/lib/ai/planning-types";

const FALLBACK_MESSAGE = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
const PlanningSuggestInputSchema = z.object({
  quoteId: z.string().min(1),
  weekStart: z.string().optional(),
});

const SlotLabelSchema = z.enum(["matin", "apres_midi"]);
const DailyLoadSchema = z.enum(["faible", "moyenne", "forte"]);
const PlanningSuggestResponseSchema = z.object({
  recommendedSlot: z.object({
    date: z.string(),
    slotLabel: SlotLabelSchema,
  }),
  dailyLoad: z.record(z.string(), DailyLoadSchema),
});

function buildContext(
  quoteDurationHours: number,
  weekStart: string,
  assignments: Awaited<ReturnType<typeof getPlanningAssignments>>
): string {
  const days = getWeekDays(weekStart);
  const lines: string[] = [
    `Devis à placer : durée estimée main-d'œuvre = ${quoteDurationHours} h.`,
    "",
    "Créneaux de la semaine (chaque jour : matin = 8h-12h, apres_midi = 14h-18h) :",
  ];
  const byDateSlot: Record<string, { ref: string; hours: number }[]> = {};
  for (const d of days) byDateSlot[d] = [];
  for (const a of assignments) {
    const key = a.assignment_date;
    if (!byDateSlot[key]) byDateSlot[key] = [];
    byDateSlot[key].push({
      ref: a.reference ?? a.quote_id.slice(0, 8),
      hours: a.durationHours ?? 0,
    });
  }
  let totalHoursByDay: Record<string, number> = {};
  for (const d of days) {
    const slotEntries = assignments.filter((a) => a.assignment_date === d);
    const dayHours = slotEntries.reduce((s, a) => s + (a.durationHours ?? 0), 0);
    totalHoursByDay[d] = dayHours;
    const refs = slotEntries.map((a) => `${a.reference ?? a.quote_id.slice(0, 8)} (${a.durationHours ?? 0}h)`).join(", ") || "aucun";
    lines.push(`- ${d} : ${refs}. Total déjà placé ce jour : ${dayHours.toFixed(1)} h.`);
  }
  lines.push("");
  lines.push("Tu dois choisir UN seul créneau (date + matin ou apres_midi) pour placer ce devis. Réponds en JSON.");
  return lines.join("\n");
}

const systemPrompt = `Tu es un assistant planning pour un garage automobile. On te donne la durée (heures main-d'œuvre) d'un devis à placer et l'état actuel des créneaux de la semaine (dates, créneaux déjà occupés, heures déjà placées par jour).

RÈGLES :
1. Propose UN seul créneau recommandé : une date (YYYY-MM-DD) et un slotLabel ("matin" ou "apres_midi").
2. La date doit être parmi celles fournies dans le contexte (semaine courante).
3. Réponse strictement en JSON : { "recommendedSlot": { "date": "YYYY-MM-DD", "slotLabel": "matin" ou "apres_midi" }, "dailyLoad": { "YYYY-MM-DD": "faible"|"moyenne"|"forte", ... } }.
4. dailyLoad : pour chaque date de la semaine, indique la charge du jour APRÈS avoir placé le devis dans le créneau recommandé. Seuils : faible = moins de 4h total ce jour, moyenne = entre 4h et 8h, forte = plus de 8h.
5. Réponds en français dans les champs si besoin, mais les clés JSON et slotLabel/date restent en anglais.`;

export async function POST(request: NextRequest) {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!checkRateLimit(garageId)) {
      return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
    }
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_planning");
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
    const parsed = PlanningSuggestInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides. Vérifiez les champs." }, { status: 400 });
    }
    const quoteId = parsed.data.quoteId.trim();
    const now = new Date();
    const weekStart = parsed.data.weekStart && parsed.data.weekStart.trim() ? parsed.data.weekStart : getMondayOfWeek(now);

    const duration = await getQuoteDurationHours(quoteId);
    if (duration === null) {
      return NextResponse.json({ error: "Devis introuvable ou accès refusé" }, { status: 404 });
    }

    const days = getWeekDays(weekStart);
    const assignments = await getPlanningAssignments(weekStart);
    const context = buildContext(duration, weekStart, assignments);
    const userPrompt = `Contexte :\n${context}\n\nPropose un créneau pour ce devis et la charge par jour. Réponds en JSON uniquement : { "recommendedSlot": { "date": "YYYY-MM-DD", "slotLabel": "matin" ou "apres_midi" }, "dailyLoad": { "date1": "faible"|"moyenne"|"forte", ... } }.`;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const safeResult = await safeAiCall({
      garageId,
      userId,
      feature: "planning_suggest",
      fn: async () => {
        let result: PlanningSuggestResponse | { error: string } | null = null;
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
                const raw = response.choices[0]?.message?.content;
                if (!raw) continue;
                const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((c) => (typeof c === "string" ? c : (c as { text?: string }).text ?? "")).join("") : "";
                if (!content) continue;
                const parsed = JSON.parse(content);
                const validated = PlanningSuggestResponseSchema.safeParse(parsed);
                if (validated.success && days.includes(validated.data.recommendedSlot.date)) {
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
                const validated = PlanningSuggestResponseSchema.safeParse(parsed);
                if (validated.success && days.includes(validated.data.recommendedSlot.date)) result = validated.data;
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
              const rawContent = completion.choices[0]?.message?.content as string | { text?: string }[] | undefined;
              const contentStr = typeof rawContent === "string" ? rawContent : Array.isArray(rawContent) ? rawContent.map((c) => (typeof c === "string" ? c : (c as { text?: string }).text ?? "")).join("") : "";
              if (contentStr) {
                const parsed = JSON.parse(contentStr);
                const validated = PlanningSuggestResponseSchema.safeParse(parsed);
                if (validated.success && days.includes(validated.data.recommendedSlot.date)) result = validated.data;
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
      await logAiEvent(garageId, userId, "planning_suggest", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: safeResult.error }, { status: 200 });
    }
    const result = safeResult.data;
    if (result == null) {
      await logAiEvent(garageId, userId, "planning_suggest", "error", safeResult.latencyMs);
      return NextResponse.json(
        { fallback: true, error: "Aucune API IA configurée. Configurez MISTRAL_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY." },
        { status: 200 }
      );
    }
    if ("error" in result) {
      await logAiEvent(garageId, userId, "planning_suggest", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: FALLBACK_MESSAGE }, { status: 200 });
    }

    const sanitized: PlanningSuggestResponse = {
      recommendedSlot: {
        date: days.includes(result.recommendedSlot.date) ? result.recommendedSlot.date : days[0],
        slotLabel: result.recommendedSlot.slotLabel,
      },
      dailyLoad: {},
    };
    for (const d of days) {
      const v = result.dailyLoad[d];
      sanitized.dailyLoad[d] = (v === "faible" || v === "moyenne" || v === "forte" ? v : "faible") as DailyLoadLevel;
    }
    await recordAiUsage(garageId);
    await logAiEvent(garageId, userId, "planning_suggest", "success", safeResult.latencyMs);
    return NextResponse.json(sanitized);
  } catch {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 200 });
  }
}
