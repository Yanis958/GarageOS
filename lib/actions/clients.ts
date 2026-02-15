"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";

/** archived: undefined ou false = actifs uniquement, true = archivés uniquement */
export async function getClients(search?: string, archived?: boolean) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  console.log("🔍 getClients - garageId:", garageId, "archived:", archived);

  let list: { id: string; name: string | null; phone?: string | null; email?: string | null; created_at?: string; archived_at: string | null }[] = [];
  
  try {
    const { data: rawData, error: rawError } = await supabase
      .from("clients")
      .select("id, name, phone, email, garage_id, created_at, archived_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const result = { data: rawData, error: rawError };
    console.log("🔍 getClients - result (SANS filtre archived_at):", { 
      error: result.error?.message, 
      errorCode: result.error?.code,
      count: result.data?.length,
      firstItem: result.data?.[0],
      allGarageIds: result.data?.map(c => (c as { garage_id?: string | null }).garage_id)
    });

    if (!result.error && result.data) {
      list = result.data.map((c) => ({
        id: c.id,
        name: c.name ?? null,
        phone: (c as { phone?: string | null }).phone ?? undefined,
        email: (c as { email?: string | null }).email ?? undefined,
        created_at: c.created_at,
        archived_at: (c as { archived_at?: string | null })?.archived_at ?? null,
        ...(c as { garage_id?: string | null }),
      }));

      // Pas de filtre garage_id en JS : on s'appuie sur le RLS (comme la page diagnostic).
      // Filtrer par archived_at en JavaScript
      if (archived === true) {
        list = list.filter((c) => c.archived_at != null);
      } else {
        list = list.filter((c) => c.archived_at == null);
      }
    } else if (result.error) {
      console.error("❌ Erreur getClients:", result.error);
    }
  } catch (error) {
    console.error("❌ Erreur exception getClients:", error);
  }

  console.log("✅ getClients - list finale:", list.length, "clients");

  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter(
      (c) =>
        (c.name ?? "").toLowerCase().includes(term) ||
        (c.email ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").replace(/\s/g, "").includes(term.replace(/\s/g, ""))
    );
  }
  
  return list;
}

export async function getClientById(id: string) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("clients").select("*").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);

  const { data, error } = await query.single();
  if (error) return null;
  return data;
}

export async function archiveClient(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("clients").select("id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Client non trouvé." };

  const { error } = await supabase
    .from("clients")
    .update({ archived_at: new Date().toISOString(), archived_by: user?.id ?? null })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function restoreClient(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("clients").select("id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Client non trouvé." };

  const { error } = await supabase
    .from("clients")
    .update({ archived_at: null, archived_by: null })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function hardDeleteClient(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("clients").select("id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Client non trouvé." };

  const { count: vehiclesCount } = await supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("client_id", id);
  if (vehiclesCount && vehiclesCount > 0) return { error: "Ce client a des véhicules liés. Ouvrez sa fiche pour les consulter, les supprimer ou les archiver, puis réessayez." };

  const { count: quotesCount } = await supabase.from("quotes").select("id", { count: "exact", head: true }).eq("client_id", id);
  if (quotesCount && quotesCount > 0) return { error: "Impossible de supprimer : ce client a des devis liés. Archivez-le à la place." };

  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function createClientAction(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  
  // Essayer de récupérer l'utilisateur avec refresh de session
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error("❌ Erreur auth:", authError);
    return { error: `Erreur d'authentification: ${authError.message}. Veuillez vous reconnecter.` };
  }
  
  if (!user) {
    return { error: "Vous devez être connecté pour créer un client. Veuillez vous reconnecter depuis /login" };
  }
  
  console.log("✅ Utilisateur authentifié:", user.id);

  let garageId = await getCurrentGarageId();
  console.log("🔍 createClientAction - garageId:", garageId);

  // Si aucun garage trouvé, essayer d'en créer un automatiquement
  if (!garageId) {
    console.log("⚠️ Aucun garage trouvé, tentative de création automatique...");
    
    // Créer un garage
    const { data: newGarage, error: garageError } = await supabase
      .from("garages")
      .insert({
        name: "Mon Garage",
        address: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (garageError || !newGarage) {
      console.error("❌ Erreur création garage:", garageError);
      return { error: `Impossible de créer un garage automatiquement. Erreur: ${garageError?.message || "Inconnue"}. Veuillez exécuter DISABLE_RLS_TEMPORARILY.sql dans Supabase.` };
    }

    garageId = newGarage.id;
    console.log("✅ Garage créé automatiquement:", garageId);

    // Lier l'utilisateur au garage
    const { error: memberError } = await supabase.from("garage_members").insert({
      garage_id: garageId,
      user_id: user.id,
      role: "owner",
      created_at: new Date().toISOString(),
    });
    
    if (memberError) {
      console.error("❌ Erreur création garage_members:", memberError);
    } else {
      console.log("✅ garage_members créé");
    }
  }

  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "Le nom est obligatoire." };

  const payload: { name: string; phone?: string; email?: string; notes?: string; garage_id: string } = {
    name: name.trim(),
    phone: (formData.get("phone") as string)?.trim() || undefined,
    email: (formData.get("email") as string)?.trim() || undefined,
    notes: (formData.get("notes") as string)?.trim() || undefined,
    garage_id: garageId,
  };

  console.log("🔍 createClientAction - payload:", { ...payload, notes: payload.notes ? "[présent]" : "[absent]" });

  const { data, error } = await supabase.from("clients").insert(payload).select("id, garage_id").single();
  
  if (error) {
    console.error("❌ Erreur création client:", error);
    console.error("❌ Détails erreur:", { code: error.code, message: error.message, details: error.details });
    const msg = error.message.toLowerCase();
    if (msg.includes("garage_id") || msg.includes("policy") || msg.includes("row-level"))
      return { error: `Erreur RLS: ${error.message}. Veuillez exécuter DISABLE_RLS_TEMPORARILY.sql dans Supabase SQL Editor.` };
    return { error: error.message };
  }
  
  console.log("✅ Client créé:", { id: data.id, garage_id: data.garage_id });
  
  // Vérifier immédiatement que le client est récupérable
  const { data: verifyClient, error: verifyError } = await supabase
    .from("clients")
    .select("id, name, garage_id")
    .eq("id", data.id)
    .single();
  
  console.log("🔍 Vérification client créé:", { 
    found: !!verifyClient, 
    error: verifyError?.message,
    garage_id: verifyClient?.garage_id 
  });
  
  redirect(`/dashboard/clients/${data.id}`);
}

export type ExportClientRow = {
  nom: string;
  email: string;
  telephone: string;
  adresse: string;
  nb_vehicules: number;
  nb_devis: number;
  total_facture: number;
  created_at: string;
};

/**
 * Exporte tous les clients au format CSV
 * @returns Données formatées pour CSV ou erreur
 */
export async function exportClientsCsv(): Promise<{ data: ExportClientRow[]; error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id, name, phone, email, address, address_line2, postal_code, city, created_at, archived_at")
    .is("archived_at", null)
    .order("name");
  if (garageId) query = query.eq("garage_id", garageId);

  let result = await query;
  let clients: { id: string; name: string | null; phone?: string | null; email?: string | null; address?: string | null; address_line2?: string | null; postal_code?: string | null; city?: string | null; created_at?: string; archived_at: string | null }[] = [];

  if (result.error && (result.error.message?.includes("archived_at") || result.error.message?.includes("does not exist"))) {
    let fallbackQuery = supabase.from("clients").select("id, name, phone, email, address, address_line2, postal_code, city, created_at").order("name");
    if (garageId) fallbackQuery = fallbackQuery.eq("garage_id", garageId);
    const fallback = await fallbackQuery;
    if (fallback.error) return { data: [], error: fallback.error.message };
    clients = (fallback.data ?? []).map((c) => ({ ...c, archived_at: null as string | null }));
  } else if (!result.error && result.data) {
    clients = result.data.map((c) => ({ ...c, archived_at: (c as { archived_at?: string | null }).archived_at ?? null }));
  } else if (result.error) {
    return { data: [], error: result.error.message };
  }

  const clientIds = clients.map((c) => c.id);
  const vehiclesMap = new Map<string, number>();
  const quotesMap = new Map<string, number>();
  const totalsMap = new Map<string, number>();

  if (clientIds.length > 0) {
    let vehiclesQuery = supabase.from("vehicles").select("id, client_id").in("client_id", clientIds);
    if (garageId) vehiclesQuery = vehiclesQuery.eq("garage_id", garageId);
    const { data: vehicles } = await vehiclesQuery;

    if (vehicles) {
      for (const v of vehicles) {
        const cid = v.client_id;
        if (!cid) continue;
        vehiclesMap.set(cid, (vehiclesMap.get(cid) ?? 0) + 1);
      }
    }

    let quotesQuery = supabase.from("quotes").select("id, client_id, total_ttc, status").in("client_id", clientIds);
    if (garageId) quotesQuery = quotesQuery.eq("garage_id", garageId);
    const { data: quotes } = await quotesQuery;

    if (quotes) {
      for (const q of quotes) {
        const cid = q.client_id;
        if (!cid) continue;
        quotesMap.set(cid, (quotesMap.get(cid) ?? 0) + 1);
        if (q.status === "accepted") {
          totalsMap.set(cid, (totalsMap.get(cid) ?? 0) + (Number(q.total_ttc) || 0));
        }
      }
    }
  }

  function formatDate(date: string | null | undefined): string {
    if (!date) return "";
    try {
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return "";
    }
  }

  const rows: ExportClientRow[] = clients.map((c) => ({
    nom: c.name ?? "—",
    email: c.email ?? "—",
    telephone: c.phone ?? "—",
    adresse: [c.address, c.address_line2, c.postal_code, c.city].filter(Boolean).join(", ") || "—",
    nb_vehicules: vehiclesMap.get(c.id) ?? 0,
    nb_devis: quotesMap.get(c.id) ?? 0,
    total_facture: totalsMap.get(c.id) ?? 0,
    created_at: formatDate(c.created_at),
  }));

  return { data: rows };
}
