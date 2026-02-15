"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";
import { normalizeFrenchRegistration, isValidFrenchPlate } from "@/lib/utils/vehicle-registration";

/** archived: undefined ou false = actifs uniquement, true = archivés uniquement */
export async function getVehicles(search?: string, archived?: boolean) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  console.log("🔍 getVehicles - garageId:", garageId, "archived:", archived);

  let list: { id: string; registration: string | null; brand?: string | null; model?: string | null; year?: number | null; client_id?: string | null; clients?: { name: string | null } | null; archived_at: string | null }[] = [];
  
  try {
    const { data: rawData, error: rawError } = await supabase
      .from("vehicles")
      .select("id, registration, brand, model, year, garage_id, client_id, created_at, archived_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const result = { data: rawData, error: rawError };
    console.log("🔍 getVehicles - result (SANS filtre archived_at):", { 
      error: result.error?.message,
      errorCode: result.error?.code,
      count: result.data?.length,
      firstItem: result.data?.[0],
      allGarageIds: result.data?.map(v => (v as { garage_id?: string | null }).garage_id)
    });

    if (!result.error && result.data) {
      list = result.data.map((v) => ({
        id: v.id,
        registration: v.registration ?? null,
        brand: (v as { brand?: string | null }).brand ?? undefined,
        model: (v as { model?: string | null }).model ?? undefined,
        year: (v as { year?: number | null }).year ?? undefined,
        client_id: v.client_id ?? null,
        archived_at: (v as { archived_at?: string | null })?.archived_at ?? null,
        ...(v as { garage_id?: string | null }),
      })) as unknown as typeof list;

      // Pas de filtre garage_id en JS : on s'appuie sur le RLS (comme la page diagnostic).
      // Filtrer par archived_at en JavaScript
      if (archived === true) {
        list = list.filter((v) => v.archived_at != null);
      } else {
        list = list.filter((v) => v.archived_at == null);
      }
    } else if (result.error) {
      console.error("❌ Erreur getVehicles:", result.error);
    }

    // Récupérer les noms des clients séparément pour tous les véhicules
    if (list.length > 0) {
      const clientIdsArray = list.map(v => v.client_id).filter(Boolean) as string[];
      const clientIds = Array.from(new Set(clientIdsArray));
      
      if (clientIds.length > 0) {
        console.log("🔍 Récupération des noms de clients pour", clientIds.length, "clients");
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds);
        
        if (!clientsError && clientsData) {
          const clientsMap = new Map(clientsData.map(c => [c.id, c.name]));
          list = list.map(v => {
            const clientName = v.client_id ? clientsMap.get(v.client_id) : null;
            return {
              ...v,
              clients: clientName ? { name: clientName } : null
            };
          }) as unknown as typeof list;
          console.log("✅ Noms de clients récupérés pour", clientsData.length, "clients");
        } else {
          console.error("❌ Erreur récupération clients:", clientsError);
        }
      }
    }
  } catch (error) {
    console.error("❌ Erreur exception getVehicles:", error);
  }

  console.log("✅ getVehicles - list finale:", list.length, "véhicules");

  // Filtrer par recherche si nécessaire
  if (search?.trim()) {
    const term = search.trim().toLowerCase();
    list = list.filter((v) => {
      const reg = (v.registration ?? "").toLowerCase();
      const brand = (v.brand ?? "").toLowerCase();
      const model = (v.model ?? "").toLowerCase();
      const clientName =
        v.clients && typeof v.clients === "object" && "name" in v.clients
          ? String((v.clients as { name: string | null }).name ?? "").toLowerCase()
          : "";
      return reg.includes(term) || brand.includes(term) || model.includes(term) || clientName.includes(term);
    });
  }
  
  return list;
}

export async function getVehiclesByClientId(clientId: string, includeArchived?: boolean) {
  const supabase = await createClient();

  // Même logique que getVehicles() : pas de filtre garage_id en requête, on s'appuie sur le RLS
  // pour que la fiche client affiche les mêmes véhicules que le dropdown "Nouveau devis".
  const { data: rawData, error } = await supabase
    .from("vehicles")
    .select("id, registration, brand, model, year, vin, mileage, archived_at")
    .eq("client_id", clientId)
    .order("registration");

  if (error) {
    if (error.message?.includes("archived_at") || error.message?.includes("does not exist")) {
      const fallback = await supabase
        .from("vehicles")
        .select("id, registration, brand, model, year, vin, mileage")
        .eq("client_id", clientId)
        .order("registration");
      if (fallback.error) return [];
      return fallback.data ?? [];
    }
    return [];
  }

  let list = (rawData ?? []) as { id: string; registration: string | null; brand?: string | null; model?: string | null; year?: number | null; vin?: string | null; mileage?: number | null; archived_at?: string | null }[];
  if (!includeArchived) {
    list = list.filter((v) => v.archived_at == null);
  }
  return list.map(({ archived_at: _, ...v }) => v);
}

export async function getVehicleById(id: string) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("vehicles").select("*, clients(id, name)").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);

  const { data, error } = await query.single();
  if (error) return null;
  return data;
}

export async function createVehicleAction(_prev: unknown, formData: FormData) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  console.log("🔍 createVehicleAction - garageId:", garageId);

  const rawRegistration = (formData.get("registration") as string)?.trim();
  const clientId = formData.get("client_id") as string;
  if (!rawRegistration) return { error: "L'immatriculation est obligatoire." };
  if (!clientId) return { error: "Le client est obligatoire." };

  const registration = normalizeFrenchRegistration(rawRegistration);
  if (!isValidFrenchPlate(registration)) {
    return { error: "Format attendu : AB-123-CD (2 lettres, 3 chiffres, 2 lettres)." };
  }

  let dupQuery = supabase.from("vehicles").select("id").eq("registration", registration);
  if (garageId) dupQuery = dupQuery.eq("garage_id", garageId);
  const { data: existing } = await dupQuery.limit(1).maybeSingle();
  if (existing) return { error: "Ce véhicule existe déjà." };

  const payload: {
    registration: string;
    client_id: string;
    brand?: string;
    model?: string;
    year?: number;
    vin?: string;
    mileage?: number;
    notes?: string;
    garage_id?: string;
  } = {
    registration,
    client_id: clientId,
    brand: (formData.get("brand") as string)?.trim() || undefined,
    model: (formData.get("model") as string)?.trim() || undefined,
    vin: (formData.get("vin") as string)?.trim() || undefined,
    notes: (formData.get("notes") as string)?.trim() || undefined,
  };
  const yearVal = formData.get("year");
  if (yearVal && !Number.isNaN(Number(yearVal))) payload.year = Number(yearVal);
  const mileageVal = formData.get("mileage");
  if (mileageVal && !Number.isNaN(Number(mileageVal))) payload.mileage = Number(mileageVal);
  if (garageId) payload.garage_id = garageId;

  console.log("🔍 createVehicleAction - payload:", { ...payload, notes: payload.notes ? "[présent]" : "[absent]" });

  const { data, error } = await supabase.from("vehicles").insert(payload).select("id, garage_id").single();
  
  if (error) {
    console.error("❌ Erreur création véhicule:", error);
    console.error("❌ Détails erreur:", { code: error.code, message: error.message, details: error.details });
    const msg = error.message.toLowerCase();
    if (msg.includes("garage_id") || msg.includes("policy") || msg.includes("row-level"))
      return { error: "Erreur d'accès. Vérifiez les politiques RLS Supabase et qu'un garage existe (Paramètres)." };
    if (msg.includes("unique") || msg.includes("duplicate")) return { error: "Ce véhicule existe déjà." };
    return { error: error.message };
  }
  
  console.log("✅ Véhicule créé:", { id: data.id, garage_id: data.garage_id });
  
  // Vérifier immédiatement que le véhicule est récupérable
  const { data: verifyVehicle, error: verifyError } = await supabase
    .from("vehicles")
    .select("id, registration, garage_id")
    .eq("id", data.id)
    .single();
  
  console.log("🔍 Vérification véhicule créé:", { 
    found: !!verifyVehicle, 
    error: verifyError?.message,
    garage_id: verifyVehicle?.garage_id 
  });
  
  redirect(`/dashboard/vehicles/${data.id}?created=1`);
}

export async function createVehicleActionNoRedirect(_prev: unknown, formData: FormData): Promise<{ error?: string; vehicleId?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  const rawRegistration = (formData.get("registration") as string)?.trim();
  const clientId = formData.get("client_id") as string;
  if (!rawRegistration) return { error: "L'immatriculation est obligatoire." };
  if (!clientId) return { error: "Le client est obligatoire." };

  const registration = normalizeFrenchRegistration(rawRegistration);
  if (!isValidFrenchPlate(registration)) {
    return { error: "Format attendu : AB-123-CD (2 lettres, 3 chiffres, 2 lettres)." };
  }

  let dupQuery = supabase.from("vehicles").select("id").eq("registration", registration);
  if (garageId) dupQuery = dupQuery.eq("garage_id", garageId);
  const { data: existing } = await dupQuery.limit(1).maybeSingle();
  if (existing) return { error: "Ce véhicule existe déjà." };

  const payload: {
    registration: string;
    client_id: string;
    brand?: string;
    model?: string;
    year?: number;
    vin?: string;
    mileage?: number;
    notes?: string;
    garage_id?: string;
  } = {
    registration,
    client_id: clientId,
    brand: (formData.get("brand") as string)?.trim() || undefined,
    model: (formData.get("model") as string)?.trim() || undefined,
    vin: (formData.get("vin") as string)?.trim() || undefined,
    notes: (formData.get("notes") as string)?.trim() || undefined,
  };
  const yearVal = formData.get("year");
  if (yearVal && !Number.isNaN(Number(yearVal))) payload.year = Number(yearVal);
  const mileageVal = formData.get("mileage");
  if (mileageVal && !Number.isNaN(Number(mileageVal))) payload.mileage = Number(mileageVal);
  if (garageId) payload.garage_id = garageId;

  const { data, error } = await supabase.from("vehicles").insert(payload).select("id").single();
  
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("garage_id") || msg.includes("policy") || msg.includes("row-level"))
      return { error: "Erreur d'accès. Vérifiez les politiques RLS Supabase et qu'un garage existe (Paramètres)." };
    if (msg.includes("unique") || msg.includes("duplicate")) return { error: "Ce véhicule existe déjà." };
    return { error: error.message };
  }
  
  // Revalider les pages qui affichent les véhicules
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/devis/new");
  
  return { vehicleId: data.id };
}

export async function updateVehicleAction(_prev: unknown, formData: FormData): Promise<{ error?: string; vehicleId?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  const vehicleId = formData.get("vehicle_id") as string;

  if (!vehicleId) return { error: "ID véhicule manquant." };

  const rawRegistration = (formData.get("registration") as string)?.trim();
  if (!rawRegistration) return { error: "L'immatriculation est obligatoire." };

  const registration = normalizeFrenchRegistration(rawRegistration);
  if (!isValidFrenchPlate(registration)) {
    return { error: "Format attendu : AB-123-CD (2 lettres, 3 chiffres, 2 lettres)." };
  }

  // Vérifier que le véhicule existe et appartient au garage
  let query = supabase.from("vehicles").select("id, garage_id").eq("id", vehicleId);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: existing, error: fetchErr } = await query.single();
  if (fetchErr || !existing) return { error: "Véhicule non trouvé." };

  // Vérifier unicité immatriculation (sauf pour ce véhicule)
  let dupQuery = supabase.from("vehicles").select("id").eq("registration", registration).neq("id", vehicleId);
  if (garageId) dupQuery = dupQuery.eq("garage_id", garageId);
  const { data: duplicate } = await dupQuery.limit(1).maybeSingle();
  if (duplicate) return { error: "Cette immatriculation est déjà utilisée par un autre véhicule." };

  const payload: {
    registration: string;
    brand?: string;
    model?: string;
    year?: number;
    vin?: string;
    mileage?: number;
    notes?: string;
  } = {
    registration,
    brand: (formData.get("brand") as string)?.trim() || undefined,
    model: (formData.get("model") as string)?.trim() || undefined,
    vin: (formData.get("vin") as string)?.trim() || undefined,
    notes: (formData.get("notes") as string)?.trim() || undefined,
  };

  const yearVal = formData.get("year");
  if (yearVal && !Number.isNaN(Number(yearVal))) payload.year = Number(yearVal);

  const mileageVal = formData.get("mileage");
  if (mileageVal && !Number.isNaN(Number(mileageVal))) payload.mileage = Number(mileageVal);

  // Récupérer le client_id du véhicule avant la mise à jour pour revalider
  const { data: vehicleData } = await supabase.from("vehicles").select("client_id").eq("id", vehicleId).single();
  
  const { error } = await supabase.from("vehicles").update(payload).eq("id", vehicleId);
  if (error) {
    console.error("❌ Erreur mise à jour véhicule:", error);
    return { error: error.message };
  }

  // Revalider les pages qui affichent les véhicules
  if (vehicleData?.client_id) {
    revalidatePath(`/dashboard/clients/${vehicleData.client_id}`);
  }
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/devis/new");

  return { vehicleId };
}

export async function deleteVehicleAction(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  // Vérifier que le véhicule existe et appartient au garage
  let query = supabase.from("vehicles").select("id, client_id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: existing, error: fetchErr } = await query.single();
  if (fetchErr || !existing) return { error: "Véhicule non trouvé." };

  // Vérifier qu'il n'y a pas de devis actifs liés
  let quotesQuery = supabase.from("quotes").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
  if (garageId) quotesQuery = quotesQuery.eq("garage_id", garageId);
  quotesQuery = quotesQuery.is("archived_at", null);
  const { count: activeQuotesCount } = await quotesQuery;
  if (activeQuotesCount && activeQuotesCount > 0) {
    return {
      error:
        activeQuotesCount === 1
          ? "Impossible de supprimer : ce véhicule est lié à un devis actif."
          : `Impossible de supprimer : ce véhicule est lié à ${activeQuotesCount} devis actifs.`,
    };
  }

  const clientId = existing.client_id;

  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return { error: error.message };
  
  // Revalider les pages qui affichent les véhicules
  if (clientId) {
    revalidatePath(`/dashboard/clients/${clientId}`);
  }
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/devis/new");
  
  return {};
}

export async function archiveVehicle(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("vehicles").select("id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Véhicule non trouvé." };

  let quotesQuery = supabase.from("quotes").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
  if (garageId) quotesQuery = quotesQuery.eq("garage_id", garageId);
  quotesQuery = quotesQuery.is("archived_at", null);
  const { count: activeQuotesCount } = await quotesQuery;
  if (activeQuotesCount && activeQuotesCount > 0) {
    return {
      error:
        activeQuotesCount === 1
          ? "Impossible d'archiver : ce véhicule est lié à un devis actif. Archivez d'abord le devis."
          : `Impossible d'archiver : ce véhicule est lié à ${activeQuotesCount} devis actifs. Archivez d'abord les devis.`,
    };
  }

  const { error } = await supabase
    .from("vehicles")
    .update({ archived_at: new Date().toISOString(), archived_by: user?.id ?? null })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function restoreVehicle(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("vehicles").select("id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Véhicule non trouvé." };

  const { error } = await supabase.from("vehicles").update({ archived_at: null, archived_by: null }).eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function hardDeleteVehicle(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("vehicles").select("id, client_id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Véhicule non trouvé." };

  const { count: quotesCount } = await supabase.from("quotes").select("id", { count: "exact", head: true }).eq("vehicle_id", id);
  if (quotesCount && quotesCount > 0) return { error: "Impossible de supprimer : ce véhicule est lié à des devis. Archivez-le à la place." };

  const clientId = row.client_id;

  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return { error: error.message };
  
  // Revalider les pages qui affichent les véhicules
  if (clientId) {
    revalidatePath(`/dashboard/clients/${clientId}`);
  }
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/devis/new");
  
  return {};
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

export type ExportVehicleRow = {
  immatriculation: string;
  marque: string;
  modele: string;
  annee: string;
  client: string;
  nb_devis: number;
  total_facture: number;
  created_at: string;
};

/**
 * Exporte tous les véhicules au format CSV
 * @returns Données formatées pour CSV ou erreur
 */
export async function exportVehiclesCsv(): Promise<{ data: ExportVehicleRow[]; error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("id, registration, brand, model, year, client_id, created_at, archived_at")
    .is("archived_at", null)
    .order("registration");
  if (garageId) query = query.eq("garage_id", garageId);

  let result = await query;
  let vehicles: { id: string; registration: string | null; brand?: string | null; model?: string | null; year?: number | null; client_id?: string | null; created_at?: string; archived_at: string | null }[] = [];

  if (result.error && (result.error.message?.includes("archived_at") || result.error.message?.includes("does not exist"))) {
    let fallbackQuery = supabase.from("vehicles").select("id, registration, brand, model, year, client_id, created_at").order("registration");
    if (garageId) fallbackQuery = fallbackQuery.eq("garage_id", garageId);
    const fallback = await fallbackQuery;
    if (fallback.error) return { data: [], error: fallback.error.message };
    vehicles = (fallback.data ?? []).map((v) => ({ ...v, archived_at: null as string | null }));
  } else if (!result.error && result.data) {
    vehicles = result.data.map((v) => ({ ...v, archived_at: (v as { archived_at?: string | null }).archived_at ?? null }));
  } else if (result.error) {
    return { data: [], error: result.error.message };
  }

  const clientIds = vehicles.map((v) => v.client_id).filter(Boolean) as string[];
  const clientsMap = new Map<string, string>();

  if (clientIds.length > 0) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
    if (clients) {
      for (const c of clients) {
        clientsMap.set(c.id, c.name ?? "—");
      }
    }
  }

  const vehicleIds = vehicles.map((v) => v.id);
  const quotesMap = new Map<string, number>();
  const totalsMap = new Map<string, number>();

  if (vehicleIds.length > 0) {
    let quotesQuery = supabase.from("quotes").select("id, vehicle_id, total_ttc, status").in("vehicle_id", vehicleIds);
    if (garageId) quotesQuery = quotesQuery.eq("garage_id", garageId);
    const { data: quotes } = await quotesQuery;

    if (quotes) {
      for (const q of quotes) {
        const vid = q.vehicle_id;
        if (!vid) continue;
        quotesMap.set(vid, (quotesMap.get(vid) ?? 0) + 1);
        if (q.status === "accepted") {
          totalsMap.set(vid, (totalsMap.get(vid) ?? 0) + (Number(q.total_ttc) || 0));
        }
      }
    }
  }

  const rows: ExportVehicleRow[] = vehicles.map((v) => ({
    immatriculation: v.registration ?? "—",
    marque: v.brand ?? "—",
    modele: v.model ?? "—",
    annee: v.year ? String(v.year) : "—",
    client: v.client_id ? clientsMap.get(v.client_id) ?? "—" : "—",
    nb_devis: quotesMap.get(v.id) ?? 0,
    total_facture: totalsMap.get(v.id) ?? 0,
    created_at: formatDate(v.created_at),
  }));

  return { data: rows };
}
