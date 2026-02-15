export type SlotLabel = "matin" | "apres_midi";

export type RecommendedSlot = {
  date: string;
  slotLabel: SlotLabel;
};

export type DailyLoadLevel = "faible" | "moyenne" | "forte";

export type PlanningSuggestResponse = {
  recommendedSlot: RecommendedSlot;
  dailyLoad: Record<string, DailyLoadLevel>;
};
