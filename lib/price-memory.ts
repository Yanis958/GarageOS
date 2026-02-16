/**
 * Mémoire de prix par garage : stocke et récupère les prix préférés (pièces, main-d'œuvre, forfaits).
 * Multi-tenant : chaque garage a sa propre mémoire.
 */

import { createClient } from "@/lib/supabase/server";

export type PriceBookItemType = "part" | "labor" | "forfait";

const STOP_WORDS = /\b(de|du|des|le|la|les|un|une|et|en|au|aux|à|pour)\b/gi;

/**
 * Normalise un libellé pour en faire une clé de recherche stable.
 * - lowercase, sans accents, sans ponctuation, espaces multiples → un seul, trim.
 * - suppression des mots courants (de, du, le, la…) pour matcher "Plaquettes de frein avant" et "Plaquettes frein avant".
 */
export function normalizeKey(text: string): string {
  if (!text || typeof text !== "string") return "";
  let s = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(STOP_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/**
 * Vérifie si la mémoire de prix est activée pour le garage (custom_settings.price_memory_enabled).
 * Par défaut : true.
 */
export async function isPriceMemoryEnabled(garageId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("garage_settings")
    .select("custom_settings")
    .eq("garage_id", garageId)
    .maybeSingle();
  const custom = (data?.custom_settings as { price_memory_enabled?: boolean } | null) ?? {};
  return custom.price_memory_enabled !== false;
}

/**
 * Récupère le prix mémorisé pour un garage + type + clé, avec fallback contextual → global.
 * Ordre : (garage_id, item_type, item_key, vehicle_make, vehicle_model) puis (..., '', '').
 */
export async function getPriceMemory(
  garageId: string,
  itemType: PriceBookItemType,
  itemKey: string,
  vehicleMake?: string | null,
  vehicleModel?: string | null
): Promise<number | null> {
  if (!itemKey.trim()) return null;
  const supabase = await createClient();

  const make = (vehicleMake?.trim() ?? "") || "";
  const model = (vehicleModel?.trim() ?? "") || "";

  const tryLookup = async (key: string, vMake: string, vModel: string): Promise<number | null> => {
    const { data } = await supabase
      .from("garage_price_book")
      .select("last_price")
      .eq("garage_id", garageId)
      .eq("item_type", itemType)
      .eq("item_key", key)
      .eq("vehicle_make", vMake)
      .eq("vehicle_model", vModel)
      .maybeSingle();
    return data?.last_price != null ? Number(data.last_price) : null;
  };

  // 1) Lookup contextuel (même véhicule) si make ou model fourni
  if (make || model) {
    const p = await tryLookup(itemKey, make, model);
    if (p != null) return p;
  }

  // 2) Fallback global (vehicle_make et vehicle_model vides)
  const global = await tryLookup(itemKey, "", "");
  if (global != null) return global;

  return null;
}

/**
 * Enregistre ou met à jour un prix préféré pour le garage.
 * Si vehicle_make/model fournis : règle contextuelle ; sinon : règle globale.
 * Utilise select puis update ou insert pour éviter les soucis d'onConflict avec l'index unique.
 */
export async function upsertPriceMemory(
  garageId: string,
  itemType: PriceBookItemType,
  itemKey: string,
  itemLabel: string,
  lastPrice: number,
  vehicleMake?: string | null,
  vehicleModel?: string | null
): Promise<{ error?: string }> {
  if (!itemKey.trim()) return {};
  const supabase = await createClient();

  const make = (vehicleMake?.trim() ?? "") || "";
  const model = (vehicleModel?.trim() ?? "") || "";

  const { data: existing } = await supabase
    .from("garage_price_book")
    .select("id")
    .eq("garage_id", garageId)
    .eq("item_type", itemType)
    .eq("item_key", itemKey)
    .eq("vehicle_make", make)
    .eq("vehicle_model", model)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("garage_price_book")
      .update({
        item_label: itemLabel.slice(0, 500) || null,
        last_price: lastPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("garage_price_book").insert({
      garage_id: garageId,
      item_type: itemType,
      item_key: itemKey,
      item_label: itemLabel.slice(0, 500) || null,
      vehicle_make: make,
      vehicle_model: model,
      last_price: lastPrice,
      currency: "EUR",
    });
    if (error) return { error: error.message };
  }
  return {};
}
