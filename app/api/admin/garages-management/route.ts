import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin";

export async function GET() {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("garages")
    .select("id, name, trial_end_date, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}
