import type { SlotLabel } from "@/lib/ai/planning-types";

export const SLOT_LABELS: SlotLabel[] = ["matin", "apres_midi"];
export const SLOT_DISPLAY: Record<SlotLabel, string> = {
  matin: "Matin (8h-12h)",
  apres_midi: "Après-midi (14h-18h)",
};

/** Retourne les 7 dates (YYYY-MM-DD) à partir du lundi weekStart (ISO string). */
export function getWeekDays(weekStart: string): string[] {
  const start = new Date(weekStart + "T12:00:00Z");
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Retourne le lundi (YYYY-MM-DD) de la semaine contenant la date donnée. */
export function getMondayOfWeek(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}
