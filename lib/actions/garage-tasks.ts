"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";

export type GarageTaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  done: boolean;
  quote_id: string | null;
  created_at: string;
};

export async function getGarageTasks(options?: { done?: boolean }): Promise<GarageTaskRow[]> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return [];

  const supabase = await createClient();
  let query = supabase
    .from("garage_tasks")
    .select("id, title, due_date, done, quote_id, created_at")
    .eq("garage_id", garageId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (options?.done !== undefined) query = query.eq("done", options.done);

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as GarageTaskRow[];
}

export async function createGarageTask(payload: {
  title: string;
  due_date?: string | null;
  quote_id?: string | null;
}): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé." };

  const supabase = await createClient();
  const { error } = await supabase.from("garage_tasks").insert({
    garage_id: garageId,
    title: (payload.title || "Tâche").trim(),
    due_date: payload.due_date?.trim() || null,
    quote_id: payload.quote_id || null,
    done: false,
  });
  if (error) return { error: error.message };
  return {};
}

export async function toggleGarageTaskDone(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("garage_tasks")
    .select("done")
    .eq("id", id)
    .eq("garage_id", garageId)
    .single();
  if (!row) return { error: "Tâche introuvable." };

  const { error } = await supabase
    .from("garage_tasks")
    .update({ done: !(row as { done: boolean }).done })
    .eq("id", id)
    .eq("garage_id", garageId);
  if (error) return { error: error.message };
  return {};
}

export async function deleteGarageTask(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé." };

  const supabase = await createClient();
  const { error } = await supabase.from("garage_tasks").delete().eq("id", id).eq("garage_id", garageId);
  if (error) return { error: error.message };
  return {};
}
