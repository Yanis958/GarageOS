import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/actions/admin";

export async function POST(request: Request) {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { garageId } = await request.json();
  if (!garageId) {
    return NextResponse.json({ error: "garageId requis" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("garages")
    .update({ is_active: true })
    .eq("id", garageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
