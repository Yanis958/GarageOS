import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TABLES = ["clients", "vehicles", "quotes", "quote_items", "quick_tasks", "planning_assignments"] as const;

/**
 * Route dev-only : retourne le nombre de lignes par table et par garage_id.
 * En production renvoie 404. Utile pour vérifier la répartition des données avant test d'isolation RLS.
 */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      {
        error: "SUPABASE_SERVICE_ROLE_KEY ou NEXT_PUBLIC_SUPABASE_URL manquant.",
        hint: "Voir docs/tenant-test.md pour la procédure manuelle.",
      },
      { status: 503 }
    );
  }

  const supabase = createClient(url, serviceKey);
  const result: Record<string, Record<string, number> | { _error: string }> = {};

  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("garage_id");
    if (error) {
      result[table] = { _error: error.message };
      continue;
    }
    const byGarage: Record<string, number> = {};
    for (const row of data ?? []) {
      const gid = (row as { garage_id?: string }).garage_id ?? "_null_";
      byGarage[gid] = (byGarage[gid] ?? 0) + 1;
    }
    result[table] = byGarage;
  }

  return NextResponse.json({
    message: "Résumé des lignes par table et par garage_id (service role, RLS non appliqué). Pour tester l'isolation, voir docs/tenant-test.md.",
    tables: result,
  });
}
