import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

/**
 * Route API pour créer une invitation (admin uniquement)
 * Usage: POST /api/invites/create
 * Body: { email: string, garage_id?: string, expires_in_days?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé." },
        { status: 401 }
      );
    }

    // Vérifier si l'utilisateur est admin (optionnel, à adapter selon votre logique)
    // Pour l'instant, on autorise tous les utilisateurs authentifiés

    const body = await request.json();
    const { email, garage_id, expires_in_days = 30 } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Email invalide." },
        { status: 400 }
      );
    }

    // Générer un token unique
    const token = randomBytes(32).toString("hex");

    // Calculer la date d'expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Créer l'invitation
    const { data: invite, error: insertError } = await supabase
      .from("invites")
      .insert({
        email,
        token,
        garage_id: garage_id || null,
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erreur création invite:", insertError);
      return NextResponse.json(
        { error: "Erreur lors de la création de l'invitation." },
        { status: 500 }
      );
    }

    // Générer le lien d'invitation
    const inviteUrl = `${request.nextUrl.origin}/invite?token=${token}`;

    return NextResponse.json({
      success: true,
      invite: {
        id: invite.id,
        email: invite.email,
        token: invite.token,
        expires_at: invite.expires_at,
        invite_url: inviteUrl,
      },
    });
  } catch (err) {
    console.error("Erreur création invite:", err);
    return NextResponse.json(
      { error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
