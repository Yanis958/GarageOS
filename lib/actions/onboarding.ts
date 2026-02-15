"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ADMIN_FEATURE_KEYS } from "@/lib/admin/constants";

export type CreateGarageResult = { error?: string };

/**
 * Crée le premier garage pour l'utilisateur connecté (onboarding).
 * Insère garages + garage_members(owner) + garage_settings (défauts) + garage_feature_flags (défauts).
 * L'utilisateur doit être authentifié et ne doit pas déjà être membre d'un garage.
 * Compatible useActionState : (prev, formData) => Promise<CreateGarageResult> ; redirige vers /dashboard en cas de succès.
 */
export async function createFirstGarageAction(
  _prev: CreateGarageResult | null,
  formData: FormData
): Promise<CreateGarageResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Non authentifié." };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) {
    return { error: "Le nom du garage est requis." };
  }

  const address = (formData.get("address") as string)?.trim() ?? null;

  const { data: existingMember } = await supabase
    .from("garage_members")
    .select("garage_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingMember?.garage_id) {
    revalidatePath("/dashboard");
    redirect("/dashboard");
  }

  // Essayer d'abord d'utiliser la fonction SECURITY DEFINER si elle existe
  const { data: functionResult, error: functionError } = await supabase.rpc("create_first_garage", {
    p_name: name,
    p_address: address,
  });

  let garageId: string | null = null;

  if (!functionError && functionResult) {
    // La fonction a réussi (retourne directement l'UUID)
    garageId = functionResult as string;
  } else {
    // Fallback : utiliser l'approche normale (nécessite les politiques RLS)
    const { data: newGarage, error: insertGarageError } = await supabase
      .from("garages")
      .insert({ name, address })
      .select("id")
      .single();

    if (insertGarageError || !newGarage?.id) {
      return { error: insertGarageError?.message ?? "Erreur lors de la création du garage." };
    }

    garageId = newGarage.id;

    const { error: memberError } = await supabase.from("garage_members").insert({
      garage_id: garageId,
      user_id: user.id,
      role: "owner",
    });

    if (memberError) {
      await supabase.from("garages").delete().eq("id", garageId);
      return { error: memberError.message };
    }

    await supabase.from("garage_settings").insert({
      garage_id: garageId,
    });

    for (const key of ADMIN_FEATURE_KEYS) {
      await supabase.from("garage_feature_flags").upsert(
        { garage_id: garageId, feature_key: key, enabled: true },
        { onConflict: "garage_id,feature_key" }
      );
    }
  }

  if (!garageId) {
    return { error: "Erreur lors de la création du garage." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  redirect("/dashboard");
}
