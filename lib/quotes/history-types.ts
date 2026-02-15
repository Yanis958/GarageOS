/**
 * Structure pour l'historique des actions sur un devis.
 * À brancher sur une table ou un log côté backend plus tard.
 */

export type QuoteActionKind =
  | "created"
  | "updated"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "archived"
  | "restored";

export type QuoteHistoryEntry = {
  id: string;
  quote_id: string;
  kind: QuoteActionKind;
  at: string; // ISO date
  by?: string; // user id
  payload?: Record<string, unknown>; // détails optionnels
};
