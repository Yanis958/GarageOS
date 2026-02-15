export type SuggestedQuoteLine = {
  description: string;
  quantity: number;
  unit_price: number;
  type: "labor" | "part" | "forfait";
};

export type QuickNoteSuggestQuoteLines = {
  kind: "quote_lines";
  lines: SuggestedQuoteLine[];
};

export type QuickNoteSuggestTask = {
  kind: "task";
  title: string;
};

export type QuickNoteSuggestResponse = QuickNoteSuggestQuoteLines | QuickNoteSuggestTask;
