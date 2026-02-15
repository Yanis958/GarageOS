/**
 * Types partagés pour l'API Contrôle IA (quote-audit) et le panneau UI.
 */

export type AuditSeverity = "info" | "warn" | "critical";

export type AuditFixAction = "ADD_LINE" | "UPDATE_LINE" | "REMOVE_LINE" | "MARK_OPTIONAL";

/** Ligne minimale pour l'audit (compatible DevisLine) */
export type AuditLineInput = {
  id?: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  type?: string;
  optional?: boolean;
  optional_reason?: string;
};

/** Ligne complète pour ADD_LINE (compatible DevisLine) */
export type AddLinePayloadLine = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  type?: "part" | "labor" | "forfait";
  optional?: boolean;
  optional_reason?: string;
  isAiGenerated?: boolean;
};

export type AddLinePayload = { line: AddLinePayloadLine };
export type UpdateLinePayload = {
  lineId: string;
  description?: string;
  quantity?: number;
  unit_price?: number;
  type?: "part" | "labor" | "forfait";
};
export type RemoveLinePayload = { lineId: string };
export type MarkOptionalPayload = { lineId: string; optional_reason?: string };

export type ProposedFixPayload =
  | AddLinePayload
  | UpdateLinePayload
  | RemoveLinePayload
  | MarkOptionalPayload;

export type ProposedFix = {
  action: AuditFixAction;
  payload: ProposedFixPayload;
};

export type Finding = {
  id: string;
  severity: AuditSeverity;
  title: string;
  explanation: string;
  proposedFix: ProposedFix;
};

export type QuoteAuditResponse = {
  findings: Finding[];
};
