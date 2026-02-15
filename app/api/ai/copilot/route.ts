import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";
import { getCurrentGarageId, getCurrentGarage } from "@/lib/actions/garage";
import { createClient } from "@/lib/supabase/server";
import { recordAiUsage, isFeatureEnabledForGarage } from "@/lib/actions/admin";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { checkAiQuota } from "@/lib/ai/quota";
import { logAiEvent } from "@/lib/ai/ai-events";
import { safeAiCall } from "@/lib/ai/safe-ai";
import { getRecentQuotes, getTodayTasksWithPriority, getQuotesByClientId } from "@/lib/actions/quotes";
import { getClients, getClientById } from "@/lib/actions/clients";
import { getVehicles } from "@/lib/actions/vehicles";
import type { CopilotAction, CopilotResponse } from "@/lib/ai/copilot-types";

const FALLBACK_MESSAGE = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
const CopilotInputSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional()
    .default([]),
});

const CopilotResponseSchema = z.object({
  answer: z.string(),
  actions: z.array(z.object({ label: z.string(), href: z.string() })),
});

const DASHBOARD_PREFIX = "/dashboard/";

/** Pages actuelles de l'app (sidebar + pages détail). Tout autre lien est refusé (ex. Actions du jour, Planning, Tasks supprimés). */
const ALLOWED_PATH_PREFIXES = [
  "/dashboard",
  "/dashboard/devis",
  "/dashboard/clients",
  "/dashboard/vehicles",
  "/dashboard/settings",
  "/dashboard/admin",
];

function isAllowedHref(href: string): boolean {
  const [path, query] = href.split("?");
  if (!path.startsWith(DASHBOARD_PREFIX)) return false;
  const lower = path.toLowerCase();
  if (lower.includes("delete") || lower.includes("archive")) return false;
  if (lower.includes("/tasks") || lower.includes("/planning") || lower.includes("/insights") || lower.includes("/debug-data")) return false;
  const pathNorm = path.replace(/\/+/g, "/");
  const allowed = ALLOWED_PATH_PREFIXES.some((prefix) => pathNorm === prefix || pathNorm.startsWith(prefix + "/"));
  if (!allowed) return false;
  const q = (query ?? "").trim();
  if (q && (q.toLowerCase().includes("delete") || q.toLowerCase().includes("archive"))) return false;
  return true;
}

/** Période prise en compte pour les stats Copilote : exclut les anciens devis de test. */
const COPILOT_QUOTES_DAYS = 30;

function buildContext(
  garageInfo: { name: string | null; address: string | null } | null,
  recentQuotes: Awaited<ReturnType<typeof getRecentQuotes>>,
  todayTasks: Awaited<ReturnType<typeof getTodayTasksWithPriority>>,
  clientSummary: string | null,
  vehicleSummary: string | null
): string {
  const lines: string[] = [];
  lines.push("--- Votre garage (renseigné dans Paramètres) ---");
  if (garageInfo) {
    lines.push(`Nom du garage : ${garageInfo.name ?? "non renseigné"}.`);
    if (garageInfo.address) lines.push(`Adresse : ${garageInfo.address}.`);
  } else {
    lines.push("Nom du garage : non renseigné.");
  }
  lines.push("");
  lines.push(`--- Devis des ${COPILOT_QUOTES_DAYS} derniers jours uniquement (anciens devis test exclus) ---`);
  for (const q of recentQuotes) {
    const name = q.clients && typeof q.clients === "object" && "name" in q.clients ? (q.clients as { name: string | null }).name : null;
    lines.push(`Devis id=${q.id} ref=${q.reference ?? ""} statut=${q.status} total_ttc=${q.total_ttc ?? 0} valid_until=${q.valid_until ?? ""} client=${name ?? ""}`);
  }
  lines.push("");
  lines.push("--- À faire aujourd'hui (priorité) ---");
  for (const t of todayTasks) {
    const name = t.clients && typeof t.clients === "object" && "name" in t.clients ? (t.clients as { name: string | null }).name : null;
    lines.push(`Devis id=${t.id} ref=${t.reference ?? ""} type=${t.taskType} priorité=${t.priorityScore} client=${name ?? ""}`);
  }
  if (clientSummary) {
    lines.push("");
    lines.push("--- Dossier client ---");
    lines.push(clientSummary);
  }
  if (vehicleSummary) {
    lines.push("");
    lines.push("--- Véhicules ---");
    lines.push(vehicleSummary);
  }
  return lines.join("\n");
}

/** Extrait un terme de recherche client depuis le message (ex. "résume dossier client Denis" -> "Denis"). */
function extractClientSearchTerm(message: string): string | null {
  const m = message.match(/(?:client|dossier|résume)\s+(?:le\s+)?(?:dossier\s+)?(?:client\s+)?([a-zA-ZÀ-ÿ\s]{2,})/i);
  if (m) return m[1].trim();
  return null;
}

/** Extrait un terme de recherche véhicule (immat ou mot après "véhicule"). */
function extractVehicleSearchTerm(message: string): string | null {
  const immatMatch = message.match(/\b([A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{2}|\d{2}[- ]?[A-Z]{2}[- ]?\d{2})\b/i);
  if (immatMatch) return immatMatch[1].replace(/\s/g, "");
  const m = message.match(/véhicule\s+(?:immat(?:riculation)?\s+)?([a-zA-Z0-9À-ÿ\s-]+?)(?:\s|$|\.|,)/i);
  if (m) return m[1].trim();
  return null;
}

/** True si le message parle de véhicule / immatriculation / plaque sans forcément donner une plaque. */
function messageAsksAboutVehicles(message: string): boolean {
  const lower = message.toLowerCase();
  return /\b(véhicule|vehicule|immatriculation|immat|plaque)\b/i.test(lower);
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
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_copilot");
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
    const parsed = CopilotInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides. Vérifiez les champs." }, { status: 400 });
    }
    const message = parsed.data.message.trim();
    const history = parsed.data.history ?? [];

    const [recentQuotesRaw, todayTasksRaw, currentGarage] = await Promise.all([
      getRecentQuotes(20),
      getTodayTasksWithPriority(10),
      getCurrentGarage(),
    ]);

    const garageInfo = currentGarage
      ? { name: currentGarage.name, address: currentGarage.address ?? null }
      : null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - COPILOT_QUOTES_DAYS);
    const cutoffIso = cutoff.toISOString();
    const recentQuotes = (recentQuotesRaw as { created_at?: string }[]).filter((q) => (q.created_at ?? "") >= cutoffIso);
    const todayTasks = (todayTasksRaw as { created_at?: string }[]).filter((t) => (t.created_at ?? "") >= cutoffIso);

    let clientSummary: string | null = null;
    const clientTerm = extractClientSearchTerm(message);
    if (clientTerm) {
      const clients = await getClients(clientTerm);
      if (clients.length > 0) {
        const first = clients[0];
        const quotes = await getQuotesByClientId(first.id);
        const totalCA = quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + Number(q.total_ttc ?? 0), 0);
        const lastRef = quotes[0] ? (quotes[0].reference ?? quotes[0].id?.slice(0, 8)) : "—";
        clientSummary = `Client id=${first.id} nom=${first.name ?? ""} email=${first.email ?? ""} téléphone=${first.phone ?? ""}. ${quotes.length} devis, dernier ref=${lastRef}, CA accepté=${totalCA.toFixed(2)} €.`;
      }
    }

    let vehicleSummary: string | null = null;
    const vehicleTerm = extractVehicleSearchTerm(message);
    if (vehicleTerm) {
      const vehicles = await getVehicles(vehicleTerm);
      if (vehicles.length > 0) {
        vehicleSummary = vehicles
          .slice(0, 10)
          .map(
            (v) =>
              `Véhicule id=${v.id} immat=${v.registration ?? ""} marque=${v.brand ?? ""} modèle=${v.model ?? ""} client=${v.clients && typeof v.clients === "object" && "name" in v.clients ? (v.clients as { name: string | null }).name : ""}`
          )
          .join("\n");
      }
    } else if (messageAsksAboutVehicles(message)) {
      const vehicles = await getVehicles();
      if (vehicles.length > 0) {
        vehicleSummary =
          "L'utilisateur demande des infos véhicule/immatriculation. Liste des véhicules (immat = plaque d'immatriculation, ex. AB-123-CD) :\n" +
          vehicles
            .slice(0, 15)
            .map(
              (v) =>
                `Véhicule id=${v.id} immat=${v.registration ?? ""} marque=${v.brand ?? ""} modèle=${v.model ?? ""} client=${v.clients && typeof v.clients === "object" && "name" in v.clients ? (v.clients as { name: string | null }).name : ""}`
            )
            .join("\n");
      }
    }

    const context = buildContext(garageInfo, recentQuotes, todayTasks, clientSummary, vehicleSummary);
    const systemPrompt = `Tu es le Copilote GarageOS : assistant stratégique pour chef de garage. Tu parles comme un conseiller business. Tu n'es pas un gadget : si le patron ne t'utilise pas, il perd de l'argent. Réponds en français.

POSITIONNEMENT : Assistant de décision. Réponses courtes, structurées, chiffrées, actionnables. Jamais de blabla. Jamais de phrases longues inutiles. Ton professionnel, clair, direct.

RÈGLES OBLIGATOIRES :
1. Ne JAMAIS répéter une donnée déjà visible sur le dashboard sans l'interpréter. Toujours analyser et conclure.
2. Toujours donner une conclusion + une action recommandée concrète.
3. Toujours prioriser ce qui impacte le chiffre d'affaires (devis à montant élevé, statut "sent", ancienneté).
4. Pas de jargon technique. Pas de réponses vagues. Si aucune donnée pertinente → proposer une action proactive (ex. créer un devis, relancer, paramétrer).
5. Ne jamais inventer de données. Ne jamais donner de conseils hors CRM garage.

DONNÉES (utiliser uniquement pour répondre ; ne rien inventer). Devis limités aux ${COPILOT_QUOTES_DAYS} derniers jours. Le nom du garage est dans "Votre garage" : l'utiliser pour "quel est le nom de mon garage", etc.
${context}

FORMAT DES RÉPONSES (3 blocs max, sauf salut/question factuelle très courte) :

SITUATION
• X devis en attente / montant total XXX € / ancienneté moyenne X jours (ou faits pertinents)

ANALYSE
Risque élevé / modéré / faible. Impact estimé sur le CA : XXX € (ou diagnostic court)

ACTION RECOMMANDÉE
1 action claire à faire immédiatement + proposer un bouton cliquable (lien) quand pertinent.

Liens autorisés UNIQUEMENT : Tableau de bord = /dashboard ; Devis = /dashboard/devis ; Factures = /dashboard/devis?status=accepted&facture_number=not_null ; Clients = /dashboard/clients ; Véhicules = /dashboard/vehicles ; Paramètres = /dashboard/settings ; Nouveau devis = /dashboard/devis/new ; détail devis = /dashboard/devis/[id] ; détail client = /dashboard/clients/[id] ; détail véhicule = /dashboard/vehicles/[id]. Ne JAMAIS proposer "Actions du jour", "Planning", "Tasks".

LOGIQUE INTELLIGENTE :
- Aucun devis en attente → ne pas pousser les relances ; proposer "Créer un devis" ou "Voir le CA".
- Taux de conversion > 70% (sur les données fournies) → suggérer "Comment scaler / capitaliser ce mois".
- Taux de conversion < 40% → suggérer "Pourquoi je perds des devis" (délais, prix, relances).
- Aucun devis créé depuis 7 jours (si visible dans les données) → alerter activité faible, proposer action.
- Prioriser systématiquement : devis montant élevé + statut sent, puis ancienneté, puis clients réguliers.

INTERDICTIONS : Ne jamais inventer des données. Ne jamais faire de réponse longue. Ne jamais être vague. Ne jamais conseiller hors CRM.

Acquittements ("ok", "merci", "parfait") : répondre en une phrase ("Parfait. Autre chose ?") et proposer 2 à 4 actions avec les liens autorisés uniquement.

Réponse strictement en JSON : { "answer": "texte avec blocs SITUATION / ANALYSE / ACTION RECOMMANDÉE", "actions": [ { "label": "Libellé", "href": "/dashboard/..." } ] }.`;
    const chatMessages: { role: "user" | "assistant"; content: string }[] = [
      ...history,
      { role: "user", content: message },
    ];

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const safeResult = await safeAiCall({
      garageId,
      userId,
      feature: "copilot",
      fn: async () => {
        let result: CopilotResponse | { error: string } | null = null;
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
                    ...chatMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
                  ],
                  responseFormat: { type: "json_object" },
                  temperature: 0.2,
                });
                const content = response.choices[0]?.message?.content;
                if (!content) continue;
                const parsed = JSON.parse(content);
                const validated = CopilotResponseSchema.safeParse(parsed);
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
              const conversationBloc =
                history.length > 0
                  ? "Conversation précédente :\n" +
                    history.map((m) => (m.role === "user" ? "Utilisateur" : "Assistant") + ": " + m.content).join("\n") +
                    "\n\nDernière question utilisateur: "
                  : "";
              const userText = conversationBloc + message + "\n\nRéponds en JSON uniquement : { \"answer\": \"...\", \"actions\": [...] }";
              const res = await genModel.generateContent({
                contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n---\n${userText}` }] }],
                generationConfig: { temperature: 0.2 },
              });
              let content = res.response.text();
              if (content) {
                content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "");
                const firstBrace = content.indexOf("{");
                const lastBrace = content.lastIndexOf("}");
                if (firstBrace !== -1 && lastBrace > firstBrace) content = content.substring(firstBrace, lastBrace + 1);
                const parsed = JSON.parse(content);
                const validated = CopilotResponseSchema.safeParse(parsed);
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
                  ...chatMessages.map((m) => ({ role: m.role, content: m.content })),
                ],
                temperature: 0.2,
                response_format: { type: "json_object" },
              });
              const content = completion.choices[0]?.message?.content;
              if (content) {
                const parsed = JSON.parse(content);
                const validated = CopilotResponseSchema.safeParse(parsed);
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
      await logAiEvent(garageId, userId, "copilot", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: safeResult.error }, { status: 200 });
    }
    const result = safeResult.data;
    if (result == null) {
      await logAiEvent(garageId, userId, "copilot", "error", safeResult.latencyMs);
      return NextResponse.json(
        { fallback: true, error: "Aucune API IA configurée. Configurez MISTRAL_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY." },
        { status: 200 }
      );
    }
    if ("error" in result) {
      await logAiEvent(garageId, userId, "copilot", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: FALLBACK_MESSAGE }, { status: 200 });
    }

    const filteredActions: CopilotAction[] = result.actions.filter((a) => isAllowedHref(a.href));
    const response: CopilotResponse = { answer: result.answer, actions: filteredActions };
    await recordAiUsage(garageId);
    await logAiEvent(garageId, userId, "copilot", "success", safeResult.latencyMs);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 200 });
  }
}
