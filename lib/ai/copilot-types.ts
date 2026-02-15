/**
 * Types pour le Copilote GarageOS (chat contextuel et actionnable).
 */

export type CopilotAction = {
  label: string;
  href: string;
};

export type CopilotResponse = {
  answer: string;
  actions: CopilotAction[];
};
