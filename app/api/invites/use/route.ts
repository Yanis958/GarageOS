import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, user_id, garage_id } = body;

    if (!token || !user_id) {
      return NextResponse.json(
        { error: "Token et user_id requis." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Vérifier que l'invitation existe et est valide
    const { data: inviteData, error: inviteError } = await supabase.rpc(
      "validate_invite_token",
      { invite_token: token }
    );

    if (inviteError || !inviteData || inviteData.length === 0) {
      return NextResponse.json(
        { error: "Invitation invalide ou expirée." },
        { status: 400 }
      );
    }

    const invite = inviteData[0];

    // Marquer l'invitation comme utilisée
    const { error: updateError } = await supabase
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token)
      .is("used_at", null);

    if (updateError) {
      console.error("Erreur marquage invite:", updateError);
      return NextResponse.json(
        { error: "Erreur lors de l'utilisation de l'invitation." },
        { status: 500 }
      );
    }

    // Lier l'utilisateur au garage si garage_id est fourni
    if (garage_id) {
      const { error: memberError } = await supabase.from("garage_members").insert({
        garage_id,
        user_id,
        role: "owner",
        created_at: new Date().toISOString(),
      });

      if (memberError) {
        console.error("Erreur création garage_members:", memberError);
        // Ne pas échouer si le membre existe déjà
        if (!memberError.message.includes("duplicate") && !memberError.message.includes("unique")) {
          return NextResponse.json(
            { error: "Erreur lors de la liaison au garage." },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Erreur utilisation invite:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
