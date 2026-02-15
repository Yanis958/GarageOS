"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";
import { getGarageDataForPdf } from "./pdf";
import type { PdfDevisPayload, PdfDevisClient, PdfDevisVehicle, PdfDevisLine } from "@/lib/pdf-devis/types";

/**
 * Génère le numéro d'avoir selon le préfixe du garage.
 * Format: {prefix}-{année}-{numéro séquentiel}
 */
export async function generateCreditNoteNumber(garageId: string): Promise<{ creditNoteNumber?: string; error?: string }> {
  const supabase = await createClient();

  // Récupérer le préfixe du garage
  const { data: settings } = await supabase
    .from("garage_settings")
    .select("credit_note_prefix")
    .eq("garage_id", garageId)
    .maybeSingle();

  const prefix = settings?.credit_note_prefix ?? "AV";
  const year = new Date().getFullYear();

  // Trouver le dernier numéro d'avoir de l'année
  const { data: lastCreditNote } = await supabase
    .from("credit_notes")
    .select("reference")
    .eq("garage_id", garageId)
    .like("reference", `${prefix}-${year}-%`)
    .order("reference", { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextNumber = 1;
  if (lastCreditNote?.reference) {
    const match = lastCreditNote.reference.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  const creditNoteNumber = `${prefix}-${year}-${String(nextNumber).padStart(3, "0")}`;
  return { creditNoteNumber };
}

/**
 * Crée un avoir depuis une facture ou manuellement.
 */
export async function createCreditNote(payload: {
  quoteId?: string | null;
  clientId: string;
  vehicleId?: string | null;
  lines: Array<{
    type: "labor" | "part" | "forfait";
    description: string;
    quantity: number;
    unitPrice: number;
    totalHt: number;
  }>;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  notesClient?: string | null;
}): Promise<{ creditNoteId?: string; error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé." };

  const supabase = await createClient();

  // Générer le numéro d'avoir
  const { creditNoteNumber, error: numError } = await generateCreditNoteNumber(garageId);
  if (numError || !creditNoteNumber) return { error: numError ?? "Erreur lors de la génération du numéro d'avoir." };

  // Créer l'avoir
  const { data: creditNote, error: insertError } = await supabase
    .from("credit_notes")
    .insert({
      garage_id: garageId,
      quote_id: payload.quoteId ?? null,
      reference: creditNoteNumber,
      client_id: payload.clientId,
      vehicle_id: payload.vehicleId ?? null,
      status: "draft",
      total_ht: payload.totalHt,
      total_tva: payload.totalTva,
      total_ttc: payload.totalTtc,
      issued_at: new Date().toISOString().slice(0, 10),
      notes_client: payload.notesClient ?? null,
    })
    .select("id")
    .single();

  if (insertError || !creditNote) {
    return { error: insertError?.message ?? "Erreur lors de la création de l'avoir." };
  }

  // Créer les lignes d'avoir
  const items = payload.lines.map((line) => ({
    credit_note_id: creditNote.id,
    garage_id: garageId,
    type: line.type,
    description: line.description,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    total: line.totalHt,
  }));

  const { error: itemsError } = await supabase.from("credit_note_items").insert(items);
  if (itemsError) {
    // Nettoyer l'avoir créé en cas d'erreur
    await supabase.from("credit_notes").delete().eq("id", creditNote.id);
    return { error: itemsError.message };
  }

  return { creditNoteId: creditNote.id };
}

/**
 * Récupère les données d'un avoir pour la génération PDF.
 */
export async function getCreditNoteForPdf(creditNoteId: string): Promise<{ payload?: PdfDevisPayload; error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé." };

  const supabase = await createClient();

  // Récupérer l'avoir avec les relations
  const { data: creditNote, error: creditNoteError } = await supabase
    .from("credit_notes")
    .select(
      `
      *,
      clients(id, name, phone, email, address, address_line2, postal_code, city),
      vehicles(id, brand, model, registration, vin)
    `
    )
    .eq("id", creditNoteId)
    .eq("garage_id", garageId)
    .single();

  if (creditNoteError || !creditNote) {
    return { error: creditNoteError?.message ?? "Avoir non trouvé." };
  }

  // Récupérer les lignes
  const { data: items, error: itemsError } = await supabase
    .from("credit_note_items")
    .select("*")
    .eq("credit_note_id", creditNoteId)
    .order("created_at");

  if (itemsError) {
    return { error: itemsError.message };
  }

  // Récupérer les données garage
  const garageData = await getGarageDataForPdf(garageId);
  if (!garageData) {
    return { error: "Impossible de récupérer les données du garage." };
  }

  // Construire le client
  const client = creditNote.clients as {
    id: string;
    name: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    address_line2?: string | null;
    postal_code?: string | null;
    city?: string | null;
  } | null;

  const pdfClient: PdfDevisClient = {
    name: client?.name ?? "—",
    address: client?.address ?? null,
    address_line2: client?.address_line2 ?? null,
    postal_code: client?.postal_code ?? null,
    city: client?.city ?? null,
    email: client?.email ?? null,
    phone: client?.phone ?? null,
  };

  // Construire le véhicule
  const vehicle = creditNote.vehicles as {
    id: string;
    brand?: string | null;
    model?: string | null;
    registration?: string | null;
    vin?: string | null;
  } | null;

  const pdfVehicle: PdfDevisVehicle = {
    brand: vehicle?.brand ?? null,
    model: vehicle?.model ?? null,
    registration: vehicle?.registration ?? null,
    vin: vehicle?.vin ?? null,
  };

  // Construire les lignes
  const LINE_TYPE_LABELS: Record<"labor" | "part" | "forfait", string> = {
    labor: "Main-d'œuvre",
    part: "Pièce",
    forfait: "Forfait",
  };

  const pdfLines: PdfDevisLine[] = (items ?? []).map((item: any) => ({
    type: (item.type === "labor" || item.type === "part" || item.type === "forfait" ? item.type : "part") as "labor" | "part" | "forfait",
    typeLabel: LINE_TYPE_LABELS[item.type as "labor" | "part" | "forfait"] ?? "Pièce",
    description: item.description ?? "",
    quantity: Number(item.quantity) ?? 0,
    unitPrice: Number(item.unit_price) ?? 0,
    totalHt: Number(item.total) ?? 0,
  }));

  // Récupérer le taux de TVA du garage
  const { data: settings } = await supabase
    .from("garage_settings")
    .select("vat_rate, payment_delay_days, pdf_footer, quote_valid_days")
    .eq("garage_id", garageId)
    .maybeSingle();

  const vatRate = settings?.vat_rate ?? 20;
  const paymentDelayDays = settings?.payment_delay_days ?? null;

  // Calculer la date d'échéance si nécessaire
  let dueDate: string | null = null;
  if (paymentDelayDays && creditNote.issued_at) {
    const issuedDate = new Date(creditNote.issued_at);
    issuedDate.setDate(issuedDate.getDate() + paymentDelayDays);
    dueDate = issuedDate.toISOString().slice(0, 10);
  }

  // Construire le payload PDF
  const payload: PdfDevisPayload = {
    reference: creditNote.reference,
    createdAt: creditNote.created_at ? new Date(creditNote.created_at).toLocaleDateString("fr-FR") : null,
    validUntil: creditNote.issued_at ?? new Date().toISOString().slice(0, 10),
    client: pdfClient,
    vehicle: pdfVehicle,
    lines: pdfLines,
    totalHt: Number(creditNote.total_ht) ?? 0,
    totalTva: Number(creditNote.total_tva) ?? 0,
    totalTtc: Number(creditNote.total_ttc) ?? 0,
    notesClient: creditNote.notes_client ?? null,
    issuedAt: creditNote.issued_at ? new Date(creditNote.issued_at).toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR"),
    garage: garageData,
    vatRate,
    pdfFooter: garageData?.pdfFooter ?? null,
    quoteValidDays: settings?.quote_valid_days ?? 30,
    documentType: "avoir",
    creditNoteNumber: creditNote.reference,
    dueDate,
  };

  return { payload };
}

/**
 * Récupère tous les avoirs du garage.
 */
export async function getCreditNotes(archived?: boolean) {
  const garageId = await getCurrentGarageId();
  if (!garageId) return [];

  const supabase = await createClient();

  let query = supabase
    .from("credit_notes")
    .select("id, reference, status, total_ttc, issued_at, created_at, archived_at, clients(name)")
    .eq("garage_id", garageId)
    .order("created_at", { ascending: false });

  if (archived === true) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

/**
 * Récupère un avoir par son ID.
 */
export async function getCreditNoteById(id: string) {
  const garageId = await getCurrentGarageId();
  if (!garageId) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("credit_notes")
    .select(
      `
      *,
      clients(id, name, phone, email, address, address_line2, postal_code, city),
      vehicles(id, brand, model, registration, vin)
    `
    )
    .eq("id", id)
    .eq("garage_id", garageId)
    .single();

  if (error) return null;
  return data;
}
