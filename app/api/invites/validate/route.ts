import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { error: "Token d'invitation manquant." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  try {
    // Utiliser la fonction RPC pour valider le token
    const { data, error } = await supabase.rpc("validate_invite_token", {
      invite_token: token,
    });

    if (error) {
      console.error("Erreur validation invite:", error);
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré." },
        { status: 400 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Lien d'invitation invalide ou expiré." },
        { status: 404 }
      );
    }

    const invite = data[0];

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      garage_id: invite.garage_id,
      expires_at: invite.expires_at,
    });
  } catch (err) {
    console.error("Erreur validation invite:", err);
    return NextResponse.json(
      { error: "Erreur serveur lors de la validation." },
      { status: 500 }
    );
  }
}
