import type { Finding, ProposedFix } from "@/lib/ai/quote-audit-types";
import type { DevisLine } from "@/components/dashboard/DevisLineEditor";

type LineType = "part" | "labor" | "forfait";

function computeLineTotal(type: LineType, qty: number, unitPrice: number): number {
  if (type === "forfait") return Math.round(unitPrice * 100) / 100;
  return Math.round(qty * unitPrice * 100) / 100;
}

function toLineType(t: string | undefined): LineType {
  if (t === "labor" || t === "forfait") return t;
  return "part";
}

/**
 * Applique un correctif d'audit sur les lignes et retourne les nouvelles lignes.
 * Ne persiste pas en base : l'appelant doit appeler onApplyFix puis l'utilisateur enregistre.
 */
export function applyFinding(finding: Finding, currentLines: DevisLine[]): DevisLine[] {
  const fix = finding.proposedFix;
  const action = fix.action;
  const payload = fix.payload as Record<string, unknown>;

  if (action === "ADD_LINE") {
    const line = payload.line as {
      id?: string;
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
      type?: string;
      optional?: boolean;
      optional_reason?: string;
    };
    const type = toLineType(line.type);
    const qty = type === "forfait" ? 1 : (line.quantity ?? 0);
    const up = line.unit_price ?? 0;
    const total = line.total ?? computeLineTotal(type, qty, up);
    const newLine: DevisLine = {
      id: (line.id as string) || crypto.randomUUID(),
      description: line.description ?? "",
      quantity: qty,
      unit_price: up,
      total,
      type,
      optional: line.optional,
      optional_reason: line.optional_reason,
    };
    return [...currentLines, newLine];
  }

  if (action === "UPDATE_LINE") {
    const lineId = payload.lineId as string;
    const idx = currentLines.findIndex((l) => l.id === lineId);
    if (idx < 0) return currentLines;
    const prev = currentLines[idx];
    const type = toLineType((payload.type as string) ?? prev.type);
    const quantity = typeof payload.quantity === "number" ? payload.quantity : prev.quantity;
    const unit_price = typeof payload.unit_price === "number" ? payload.unit_price : prev.unit_price;
    const qty = type === "forfait" ? 1 : quantity;
    const total = computeLineTotal(type, qty, unit_price);
    const updated: DevisLine = {
      ...prev,
      type,
      quantity: qty,
      unit_price,
      total,
      description: (payload.description as string) ?? prev.description,
    };
    const next = [...currentLines];
    next[idx] = updated;
    return next;
  }

  if (action === "REMOVE_LINE") {
    const lineId = payload.lineId as string;
    return currentLines.filter((l) => l.id !== lineId);
  }

  if (action === "MARK_OPTIONAL") {
    const lineId = payload.lineId as string;
    const optional_reason = (payload.optional_reason as string) ?? "Option recommandée";
    return currentLines.map((l) =>
      l.id === lineId ? { ...l, optional: true, optional_reason } : l
    );
  }

  return currentLines;
}

/**
 * Applique plusieurs correctifs dans l'ordre. Les lineId restent valides car on travaille sur une copie.
 */
export function applyAllFindings(findings: Finding[], currentLines: DevisLine[]): DevisLine[] {
  let lines = currentLines;
  for (const f of findings) {
    lines = applyFinding(f, lines);
  }
  return lines;
}
