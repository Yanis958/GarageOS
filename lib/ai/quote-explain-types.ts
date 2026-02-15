/**
 * Types pour l'API "Expliquer le devis au client".
 * Réponse stricte et entrée de la route.
 */

export type QuoteExplainLineInput = {
  description?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  type?: string;
  optional?: boolean;
  optional_reason?: string;
};

export type QuoteExplainRequest = {
  quoteId: string;
  lines: QuoteExplainLineInput[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  durationEstimate?: string;
};

export type QuoteExplainFaqItem = {
  q: string;
  a: string;
};

export type QuoteExplainResponse = {
  short: string;
  detailed: string[];
  faq: QuoteExplainFaqItem[];
};
