import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getQuoteById } from "@/lib/actions/quotes";
import { getCurrentGarageId, getCurrentGarageWithSettings } from "@/lib/actions/garage";
import { createClient } from "@/lib/supabase/server";
import { recordAiUsage, isFeatureEnabledForGarage } from "@/lib/actions/admin";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { checkAiQuota } from "@/lib/ai/quota";
import { logAiEvent } from "@/lib/ai/ai-events";
import type { AuditLineInput, Finding, QuoteAuditResponse } from "@/lib/ai/quote-audit-types";

const QuoteAuditInputSchema = z.object({
  quoteId: z.string().min(1),
  hourlyRate: z.number().positive().optional(),
  lines: z.array(z.object({
    id: z.string().optional(),
    description: z.string().optional(),
    quantity: z.number().optional(),
    unit_price: z.number().optional(),
    total: z.number().optional(),
    type: z.string().optional(),
    optional: z.boolean().optional(),
  })).optional(),
});

function normalizeType(t: string | undefined): "part" | "labor" | "forfait" {
  if (t === "labor" || t === "forfait") return t;
  return "part";
}

function runAuditRules(
  lines: AuditLineInput[],
  hourlyRate: number
): Finding[] {
  const findings: Finding[] = [];
  const idGen = () => `finding-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const hasPart = lines.some((l) => normalizeType(l.type) === "part");
  const hasLabor = lines.some((l) => normalizeType(l.type) === "labor");
  const descLower = (d: string | undefined) => (d ?? "").toLowerCase();

  // 1. Détection de doublon
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = descLower(lines[i].description);
      const b = descLower(lines[j].description);
      if (!a || !b) continue;
      // Détecter doublons exacts ou très similaires
      const isDuplicate =
        a === b ||
        (a.includes("plaquette") && b.includes("plaquette") && normalizeType(lines[i].type) === normalizeType(lines[j].type)) ||
        (a.includes("huile") && b.includes("huile") && normalizeType(lines[i].type) === normalizeType(lines[j].type));
      if (isDuplicate && lines[j].id) {
        const lineId = lines[j].id;
        if (lineId) {
          findings.push({
            id: idGen(),
            severity: "warn",
            title: "Doublon détecté",
            explanation: `« ${(lines[i].description ?? "").slice(0, 40)} » apparaît en double.`,
            proposedFix: {
              action: "REMOVE_LINE",
              payload: { lineId },
            },
          });
        }
        break;
      }
    }
  }

  // 2. Cohérence pièce ↔ main-d'œuvre
  // Pièce nécessitant main-d'œuvre sans ligne MO associée
  const needsLaborParts = lines.filter((l) => {
    const d = descLower(l.description);
    return normalizeType(l.type) === "part" && (
      d.includes("plaquette") ||
      d.includes("disque") ||
      d.includes("filtre") ||
      d.includes("vidange") ||
      d.includes("frein")
    );
  });
  if (needsLaborParts.length > 0 && !hasLabor) {
    findings.push({
      id: idGen(),
      severity: "warn",
      title: "Pièce sans main-d'œuvre associée",
      explanation: "Des pièces nécessitent une intervention mécanique. Ajoutez une ligne de main-d'œuvre.",
      proposedFix: {
        action: "ADD_LINE",
        payload: {
          line: {
            description: "Main-d'œuvre",
            quantity: 1,
            unit_price: hourlyRate,
            total: hourlyRate,
            type: "labor",
          },
        },
      },
    });
  }

  // 3. Oublis classiques
  // Vidange sans filtre
  const hasVidange = lines.some((l) => descLower(l.description).includes("vidange"));
  const hasFiltre = lines.some((l) => descLower(l.description).includes("filtre"));
  if (hasVidange && !hasFiltre) {
    findings.push({
      id: idGen(),
      severity: "warn",
      title: "Vidange sans filtre",
      explanation: "Une vidange nécessite généralement le remplacement du filtre à huile.",
      proposedFix: {
        action: "ADD_LINE",
        payload: {
          line: {
            description: "Filtre à huile",
            quantity: 1,
            unit_price: 15,
            total: 15,
            type: "part",
          },
        },
      },
    });
  }

  // Plaquettes sans contrôle visuel (optionnel)
  const hasPlaquettes = lines.some((l) => descLower(l.description).includes("plaquette"));
  const hasControle = lines.some((l) => 
    descLower(l.description).includes("contrôle") || 
    descLower(l.description).includes("visuel")
  );
  if (hasPlaquettes && !hasControle) {
    findings.push({
      id: idGen(),
      severity: "info",
      title: "Intervention incomplète",
      explanation: "Un contrôle visuel de sécurité peut être ajouté après remplacement des plaquettes.",
      proposedFix: {
        action: "ADD_LINE",
        payload: {
          line: {
            description: "Contrôle visuel sécurité",
            quantity: 0.25,
            unit_price: 0,
            total: 0,
            type: "labor",
            optional: true,
            optional_reason: "Inclus sans coût supplémentaire",
          },
        },
      },
    });
  }

  return findings;
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
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_quote_audit");
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
    const parsed = QuoteAuditInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides. Vérifiez les champs." }, { status: 400 });
    }
    const { quoteId, hourlyRate: bodyHourlyRate, lines: bodyLines } = parsed.data;

    const quote = await getQuoteById(quoteId);
    if (!quote) {
      return NextResponse.json({ error: "Devis introuvable ou accès refusé" }, { status: 404 });
    }

    const garageWithSettings = await getCurrentGarageWithSettings();
    const defaultHourlyRate = garageWithSettings?.settings?.hourly_rate ?? 60;
    const hourlyRate = typeof bodyHourlyRate === "number" && bodyHourlyRate > 0 ? bodyHourlyRate : defaultHourlyRate;
    let lines: AuditLineInput[] = Array.isArray(bodyLines) ? bodyLines as AuditLineInput[] : [];

    if (lines.length === 0) {
      const items = (quote as { items?: AuditLineInput[] }).items ?? [];
      lines = items.map((it: Record<string, unknown>) => ({
        id: String(it.id ?? ""),
        description: String(it.description ?? ""),
        quantity: Number(it.quantity ?? 0),
        unit_price: Number(it.unit_price ?? 0),
        total: Number(it.total ?? 0),
        type: String(it.type ?? "part"),
        optional: !!it.optional,
      }));
    }

    const start = Date.now();
    const findings = runAuditRules(lines, hourlyRate);
    const latencyMs = Date.now() - start;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await recordAiUsage(garageId);
    await logAiEvent(garageId, user?.id, "audit", "success", latencyMs);
    const response: QuoteAuditResponse = { findings };
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Erreur lors de l'analyse du devis." }, { status: 200 });
  }
}
