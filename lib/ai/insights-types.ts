export type InsightItem = {
  title: string;
  why: string;
  impact: string;
  action: string;
};

export type InsightsResponse = {
  insights: InsightItem[];
};
