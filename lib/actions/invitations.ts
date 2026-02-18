"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "./admin";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_FEATURE_KEYS } from "@/lib/admin/constants";

export type Invitation = {
  id: string;
  token: string;
  garage_name: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
  created_by: string | null;
};

export async function createInvitation(garageName: string): Promise<{ error?: string; invitation?: Invitation }> {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    return { error: "Accès refusé. Admin uniquement." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const token = randomUUID();

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      token,
      garage_name: garageName.trim(),
      used: false,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  return { invitation: data as Invitation };
}

export async function getAllInvitations(): Promise<Invitation[]> {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as Invitation[];
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;
  return data as Invitation;
}

export async function markInvitationAsUsed(token: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .update({
      used: true,
      used_at: new Date().toISOString(),
    })
    .eq("token", token);

  if (error) {
    return { error: error.message };
  }

  return {};
}

/**
 * Crée un garage depuis une invitation.
 * Crée le compte utilisateur, le garage avec trial_end_date (7 jours) et is_active = false,
 * puis marque l'invitation comme utilisée.
 */
export async function createGarageFromInvitation(
  token: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Vérifier que l'invitation existe et n'est pas utilisée
  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return { error: "Lien d'invitation invalide." };
  }
  if (invitation.used) {
    return { error: "Cette invitation a déjà été utilisée." };
  }

  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string)?.trim() || invitation.garage_name;
  const address = (formData.get("address") as string)?.trim() ?? null;

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }
  if (password.length < 6) {
    return { error: "Le mot de passe doit contenir au moins 6 caractères." };
  }

  // Créer le compte utilisateur
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !authData.user) {
    return { error: signUpError?.message ?? "Erreur lors de la création du compte." };
  }

  const userId = authData.user.id;

  // Calculer trial_end_date (7 jours à partir de maintenant)
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 7);

  // Créer le garage avec trial_end_date et is_active = false
  const { data: newGarage, error: insertGarageError } = await supabase
    .from("garages")
    .insert({
      name,
      address,
      trial_end_date: trialEndDate.toISOString(),
      is_active: false,
    })
    .select("id")
    .single();

  if (insertGarageError || !newGarage?.id) {
    // Nettoyer le compte utilisateur créé en cas d'erreur
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch {
      // Ignorer les erreurs de nettoyage
    }
    return { error: insertGarageError?.message ?? "Erreur lors de la création du garage." };
  }

  const garageId = newGarage.id;

  // Créer le lien garage_members
  const { error: memberError } = await supabase.from("garage_members").insert({
    garage_id: garageId,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    // Nettoyer en cas d'erreur
    try {
      await supabase.from("garages").delete().eq("id", garageId);
    } catch {
      // Ignorer les erreurs de nettoyage
    }
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch {
      // Ignorer les erreurs de nettoyage
    }
    return { error: memberError.message };
  }

  // Créer les settings par défaut
  await supabase.from("garage_settings").insert({
    garage_id: garageId,
  });

  // Créer les feature flags par défaut
  for (const key of ADMIN_FEATURE_KEYS) {
    await supabase.from("garage_feature_flags").upsert(
      { garage_id: garageId, feature_key: key, enabled: true },
      { onConflict: "garage_id,feature_key" }
    );
  }

  // Marquer l'invitation comme utilisée
  const markResult = await markInvitationAsUsed(token);
  if (markResult.error) {
    // L'invitation n'a pas pu être marquée comme utilisée, mais le garage est créé
    // On continue quand même
    console.error("Erreur lors du marquage de l'invitation:", markResult.error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/invitation");
  redirect("/dashboard");
}
