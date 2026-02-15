"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";

export type QuickTaskRow = {
  id: string;
  entity_type: "client" | "vehicle";
  entity_id: string;
  title: string;
  done: boolean;
  created_at: string;
};

export async function getQuickTasksByEntity(
  entityType: "client" | "vehicle",
  entityId: string
): Promise<QuickTaskRow[]> {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quick_tasks")
      .select("id, entity_type, entity_id, title, done, created_at")
      .eq("garage_id", garageId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []) as QuickTaskRow[];
  } catch {
    return [];
  }
}

export async function createQuickTask(
  entityType: "client" | "vehicle",
  entityId: string,
  title: string
): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { error } = await supabase.from("quick_tasks").insert({
    garage_id: garageId,
    entity_type: entityType,
    entity_id: entityId,
    title: title.trim() || "Tâche",
    done: false,
  });
  if (error) return { error: error.message };
  return {};
}

export async function toggleQuickTaskDone(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé" };
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("quick_tasks")
    .select("done")
    .eq("id", id)
    .eq("garage_id", garageId)
    .single();
  if (!row) return { error: "Tâche introuvable" };
  const { error } = await supabase
    .from("quick_tasks")
    .update({ done: !(row as { done: boolean }).done })
    .eq("id", id)
    .eq("garage_id", garageId);
  if (error) return { error: error.message };
  return {};
}
