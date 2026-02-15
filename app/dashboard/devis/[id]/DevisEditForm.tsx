"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { DevisLineEditor, type DevisLine } from "@/components/dashboard/DevisLineEditor";
import { QuoteSummaryCard } from "@/components/dashboard/QuoteSummaryCard";
import { QuoteAuditPanel } from "@/components/dashboard/QuoteAuditPanel";
import { useGarage } from "@/components/providers/GarageProvider";
import { QuoteExplainDrawer } from "@/components/dashboard/QuoteExplainDrawer";
import { ClientMessageDrawer } from "@/components/dashboard/ClientMessageDrawer";
import { ConfirmDialog } from "@/components/archive-actions/ConfirmDialog";
import {
  updateQuoteAction,
  saveQuoteItemsAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  getOrCreateQuoteFactureNumber,
  type QuoteItemPayload,
} from "@/lib/actions/quotes";
import { generateDevisPdf } from "@/lib/pdf-devis/generate";
import type { PdfDevisPayload, PdfDevisClient, PdfDevisVehicle } from "@/lib/pdf-devis/types";
import { getGarageDataForPdf } from "@/lib/actions/pdf";
import { getClientById } from "@/lib/actions/clients";
import { getVehicleById } from "@/lib/actions/vehicles";
import {
  Save,
  Send,
  FileDown,
  Copy,
  Trash2,
  CheckCircle,
  XCircle,
  Sparkles,
  Loader2,
  MessageCircle,
  MessageSquare,
  UserPlus,
  Car,
  AlertCircle,
  Mic,
  MicOff,
} from "lucide-react";
import Link from "next/link";

/** Date du jour + N jours au format YYYY-MM-DD */
function getDefaultValidUntil(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Durée estimée pour le drawer "Expliquer au client" (heures main-d'œuvre + libellé) */
function getDurationEstimate(lines: DevisLine[]): string {
  const hours = lines
    .filter((l) => l.type === "labor")
    .reduce((s, l) => s + (l.quantity ?? 0), 0);
  if (hours === 0) return "";
  const whole = Math.floor(hours);
  const min = Math.round((hours - whole) * 60);
  const durationStr =
    whole === 0 ? `${min} min` : min === 0 ? (whole === 1 ? "1 heure" : `${whole} heures`) : `${whole}h${min.toString().padStart(2, "0")}`;
  const immobilisation = hours <= 1 ? "1-2 heures" : hours <= 3 ? "Demi-journée" : "Journée complète";
  return `${durationStr} (${immobilisation})`;
}

type Client = { id: string; name: string | null; email?: string | null; phone?: string | null };
type Vehicle = { id: string; registration: string | null; brand?: string | null; model?: string | null; client_id?: string };

type Quote = {
  id: string;
  client_id: string;
  vehicle_id: string | null;
  status: string;
  reference: string | null;
  valid_until: string | null;
  planned_at?: string | null;
  notes: string | null;
  notes_client: string | null;
  total_ht: number;
  total_ttc: number;
  created_at: string;
  clients?: { name: string | null } | null;
  vehicles?: { registration: string | null; brand?: string | null; model?: string | null } | null;
  items?: Item[];
};

type Item = { id?: string; description?: string; quantity?: number; unit_price?: number; total?: number; type?: string; optional?: boolean; optional_reason?: string | null };

type GarageProp = { id: string; name: string | null; address: string | null } | undefined;

export function DevisEditForm({
  quote,
  clients,
  allVehicles,
  garage,
}: {
  quote: Quote;
  clients: Client[];
  allVehicles: Vehicle[];
  garage?: GarageProp;
}) {
  const router = useRouter();
  const { garage: ctxGarage, settings, vatRateDecimal, quoteValidDays, hourlyRate } = useGarage();
  const [clientId, setClientId] = useState(quote.client_id);
  const [vehicleId, setVehicleId] = useState(quote.vehicle_id ?? "");
  const [status, setStatus] = useState(quote.status);
  const [validUntil, setValidUntil] = useState(quote.valid_until?.slice(0, 10) ?? "");
  const [plannedAt, setPlannedAt] = useState((quote as Quote).planned_at?.slice(0, 10) ?? "");
  const [reference, setReference] = useState(quote.reference ?? "");
  const [notes, setNotes] = useState(quote.notes ?? "");
  const [notesClient, setNotesClient] = useState(quote.notes_client ?? "");
  const [lines, setLines] = useState<DevisLine[]>(() => {
    const items = (quote as unknown as { items?: Item[] }).items;
    return items?.length
      ? items.map((it, i) => ({
          id: (it as { id?: string }).id ?? `line-${i}`,
          description: it.description ?? "",
          quantity: it.quantity ?? 0,
          unit_price: it.unit_price ?? 0,
          total: it.total ?? 0,
          type: (it.type === "labor" || it.type === "part" || it.type === "forfait" ? it.type : "part") as DevisLine["type"],
          optional: it.optional ?? false,
          optional_reason: it.optional_reason ?? undefined,
        }))
      : [];
  });
  const [totalHt, setTotalHt] = useState(quote.total_ht ?? 0);
  const [totalTtc, setTotalTtc] = useState(quote.total_ttc ?? 0);
  const [totalTva, setTotalTva] = useState(Math.round((quote.total_ht ?? 0) * vatRateDecimal * 100) / 100);
  const [totalChanged, setTotalChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [explainDrawerOpen, setExplainDrawerOpen] = useState(false);
  const [clientMessageDrawerOpen, setClientMessageDrawerOpen] = useState(false);
  const [clientExplanationForPdf, setClientExplanationForPdf] = useState<string | null>(null);
  const [clientExplanationForEmail, setClientExplanationForEmail] = useState<string | null>(null);

  const isDraft = status === "draft";
  const vehicles = allVehicles.filter((v) => v.client_id === clientId);

  /** Auto-remplir la date de validité (aujourd'hui + quoteValidDays) si vide et brouillon */
  useEffect(() => {
    if (isDraft && !validUntil.trim()) {
      setValidUntil(getDefaultValidUntil(quoteValidDays));
    }
  }, [isDraft, quoteValidDays]); // eslint-disable-line react-hooks/exhaustive-deps -- only when draft

  useEffect(() => {
    setTotalTva(Math.round(totalHt * vatRateDecimal * 100) / 100);
  }, [totalHt, vatRateDecimal]);

  // Animation douce quand le total change
  useEffect(() => {
    setTotalChanged(true);
    const timer = setTimeout(() => setTotalChanged(false), 300);
    return () => clearTimeout(timer);
  }, [totalTtc]);

  useEffect(() => {
    if (!clientId) {
      setVehicleId("");
      return;
    }
    const list = allVehicles.filter((v) => v.client_id === clientId);
    if (list.length > 0 && !list.some((v) => v.id === vehicleId)) {
      setVehicleId(list[0].id);
    } else if (list.length === 0) {
      setVehicleId("");
    }
  }, [clientId, allVehicles, vehicleId]);

  /** Brouillon "vide" = pas de lignes ou total TTC à 0 (pour désactiver Envoyer en brouillon) */
  const isDraftEmpty = lines.length === 0 || lines.every((l) => !l.description?.trim() || (l.quantity ?? 0) <= 0 || (l.unit_price ?? 0) <= 0) || totalTtc <= 0;
  /** Envoyer : possible si brouillon non vide ; ou si devis déjà envoyé/accepté (au moins une ligne) */
  const canSend = (isDraft && !isDraftEmpty) || (!isDraft && lines.length > 0);

  async function handleSave() {
    setSaving(true);
    const err1 = await updateQuoteAction(quote.id, {
      client_id: clientId,
      vehicle_id: vehicleId || null,
      status,
      valid_until: validUntil || null,
      planned_at: plannedAt?.trim() || null,
      reference: reference || null,
      notes: notes || null,
      notes_client: notesClient || null,
      total_ht: totalHt,
      total_ttc: totalTtc,
    });
    if (err1.error) {
      toast.error(err1.error);
      setSaving(false);
      return;
    }
    const err2 = await saveQuoteItemsAction(
      quote.id,
      lines.map((l) => {
        const payload: QuoteItemPayload = {
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total: l.total,
          type: l.type,
          optional: l.optional,
          // Champs obsolètes conservés pour rétrocompatibilité mais non utilisés pour nouvelles générations IA
          optional_reason: l.optional_reason || undefined,
          estimated_range: l.estimated_range || undefined,
          pricing_note: l.pricing_note || undefined,
          cost_price_ht: l.cost_price_ht,
          margin_ht: l.margin_ht,
        };
        return payload;
      })
    );
    if (err2.error) {
      toast.error(err2.error);
      setSaving(false);
      return;
    }
    toast.success("Devis enregistré.");
    setSaving(false);
    router.refresh();
  }

  async function handleDuplicate() {
    const id = await duplicateQuoteAction(quote.id);
    if (id) {
      toast.success("Devis dupliqué.");
      router.push(`/dashboard/devis/${id}`);
    } else toast.error("Impossible de dupliquer.");
  }

  const handleConfirmDelete = useCallback(async () => {
    setActionLoading(true);
    const ok = await deleteQuoteAction(quote.id);
    setActionLoading(false);
    if (ok) {
      toast.success("Devis supprimé.");
      router.push("/dashboard/devis");
      router.refresh();
    } else toast.error("Impossible de supprimer.");
  }, [quote.id, router]);

  const handleConfirmDecline = useCallback(async () => {
    setActionLoading(true);
    const err = await updateQuoteAction(quote.id, { status: "declined" });
    setActionLoading(false);
    if (err.error) toast.error(err.error);
    else {
      setStatus("declined");
      toast.success("Devis marqué refusé.");
      router.refresh();
    }
  }, [quote.id, router]);

  async function handleStatus(newStatus: string) {
    const err = await updateQuoteAction(quote.id, { status: newStatus });
    if (err.error) {
      toast.error(err.error);
      return;
    }
    
    // Si le devis est accepté, générer automatiquement le numéro de facture
    if (newStatus === "accepted") {
      const factureRes = await getOrCreateQuoteFactureNumber(quote.id);
      if (factureRes.error) {
        // On continue quand même, le numéro pourra être généré manuellement plus tard
        console.warn("Impossible de générer le numéro de facture automatiquement:", factureRes.error);
      } else if (factureRes.factureNumber) {
        toast.success(`Devis accepté. Facture ${factureRes.factureNumber} créée.`);
      } else {
        toast.success("Devis marqué accepté.");
      }
    } else {
      toast.success("Devis marqué refusé.");
    }
    
    setStatus(newStatus);
    router.refresh();
  }

  const LINE_TYPE_LABELS: Record<string, string> = { part: "Pièce", labor: "Main-d'œuvre", forfait: "Forfait" };

  /** Calcule le total HT selon le type de ligne (identique à DevisLineEditor). */
  function computeLineTotalForType(type: "part" | "labor" | "forfait", qty: number, unitPrice: number): number {
    if (type === "forfait") return Math.round(unitPrice * 100) / 100;
    return Math.round(qty * unitPrice * 100) / 100;
  }

  /** Mapping du nouveau format JSON IA vers DevisLine (format interne) */
  function mapAiLineToDevisLine(aiLine: {
    type: "piece" | "main_oeuvre" | "forfait";
    description: string;
    quantity: number;
    unit: "unite" | "heure";
    unit_price_ht: number;
    isOption: boolean;
    isIncluded: boolean;
  }): DevisLine {
    // Mapping des types
    const typeMap: Record<"piece" | "main_oeuvre" | "forfait", "part" | "labor" | "forfait"> = {
      piece: "part",
      main_oeuvre: "labor",
      forfait: "forfait",
    };
    
    const type = typeMap[aiLine.type];
    const qty = type === "forfait" ? 1 : aiLine.quantity;
    // Si isIncluded est true, le prix doit être 0 (vérifié côté API)
    const unitPrice = aiLine.isIncluded ? 0 : aiLine.unit_price_ht;
    const total = computeLineTotalForType(type, qty, unitPrice);
    
    return {
      id: crypto.randomUUID(),
      description: aiLine.description,
      quantity: qty,
      unit_price: unitPrice,
      total,
      type,
      isAiGenerated: true,
      optional: aiLine.isOption,
      // isIncluded est géré via unit_price = 0, pas besoin de champ séparé dans DevisLine
    };
  }

  const hasSpeech =
    typeof window !== "undefined" &&
    (!!(window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      !!(window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition);

  const startSpeech = useCallback(() => {
    if (typeof window === "undefined" || aiLoading) return;
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Reconnaissance vocale non disponible dans ce navigateur.");
      return;
    }
    const rec = new SR() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { resultIndex: number; results: Record<number, { transcript: string }> & { isFinal?: boolean; length: number } }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "fr-FR";
    rec.onresult = (e) => {
      const last = e.resultIndex;
      const result = e.results[last] as unknown as (Record<number, { transcript: string }> & { isFinal?: boolean; length: number }) | undefined;
      if (!result) return;
      const isFinal = result.isFinal !== false;
      const text =
        isFinal && result[0]
          ? result[0].transcript
          : Array.from({ length: result.length }, (_, i) => result[i]?.transcript ?? "").join("");
      if (isFinal && text) setAiDescription((prev) => (prev ? `${prev} ${text}`.trim() : text));
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setIsListening(false);
    };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
  }, [aiLoading]);

  const stopSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  async function handleAiGenerate() {
    if (!aiDescription.trim()) {
      toast.error("Veuillez décrire l'intervention.");
      return;
    }

    setAiLoading(true);
    try {
      const response = await fetch("/api/ai/generate-quote-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription.trim() }),
      });

      const data = await response.json();
      const fallbackMsg = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

      if (data.fallback === true || data.error) {
        toast.error(typeof data.error === "string" ? data.error : fallbackMsg);
        setAiLoading(false);
        return;
      }
      if (!response.ok) {
        toast.error(typeof data.error === "string" ? data.error : fallbackMsg);
        setAiLoading(false);
        return;
      }

      if (!data.lines || data.lines.length === 0) {
        toast.error(fallbackMsg);
        setAiLoading(false);
        return;
      }

      // Mapper les lignes du nouveau format vers DevisLine
      const newLines: DevisLine[] = data.lines.map((line: {
        type: "piece" | "main_oeuvre" | "forfait";
        description: string;
        quantity: number;
        unit: "unite" | "heure";
        unit_price_ht: number;
        isOption: boolean;
        isIncluded: boolean;
      }) => mapAiLineToDevisLine(line));

      const updatedLines = [...lines, ...newLines];
      setLines(updatedLines);
      const newTotalHt = updatedLines.reduce((s, l) => s + l.total, 0);
      const newTotalTva = Math.round(newTotalHt * vatRateDecimal * 100) / 100;
      const newTotalTtc = Math.round((newTotalHt + newTotalTva) * 100) / 100;
      setTotalHt(newTotalHt);
      setTotalTtc(newTotalTtc);
      setAiDescription("");
      toast.success(`${newLines.length} ligne${newLines.length > 1 ? "s" : ""} générée${newLines.length > 1 ? "s" : ""} par IA. Vous pouvez modifier les prix, quantités et descriptions directement dans le tableau.`);
    } catch {
      toast.error("Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSendToClient() {
    const client = clients.find((c) => c.id === clientId);
    const ref = reference?.trim() || `Devis-${quote.id.slice(0, 8)}`;
    const subjectTemplate = settings?.email_subject ?? "Votre devis - {reference}";
    const subject = subjectTemplate.replace(/\{reference\}/gi, ref).replace(/\{ref\}/gi, ref);
    const intro = "Bonjour,\n\nVeuillez trouver ci-joint votre devis.\n\n";
    const includeExplanation = settings?.include_client_explanation_in_email !== false && !!clientExplanationForEmail?.trim();
    const explanationBlock = includeExplanation ? `${clientExplanationForEmail?.trim()}\n\n` : "";
    const signature = settings?.email_signature?.trim() || "Cordialement.";
    const bodyRaw = intro + explanationBlock + signature;
    const body = encodeURIComponent(bodyRaw);
    if (!client?.email?.trim()) {
      toast.error("Indiquez l'email du client dans sa fiche pour ouvrir votre messagerie avec son adresse.");
      return;
    }
    try {
      await handleDownloadPdf(true);
      window.location.href = `mailto:${client.email.trim()}?subject=${encodeURIComponent(subject)}&body=${body}`;
      toast.success("PDF téléchargé. Ouvrez votre messagerie et ajoutez le fichier en pièce jointe.");
      setClientExplanationForEmail(null);
    } catch {
      toast.error("Erreur lors du téléchargement du PDF.");
    }
  }

  async function handleDownloadPdf(silent = false) {
    if (lines.length === 0) return;
    try {
      // Récupérer les données complètes du client
      const clientData = await getClientById(clientId);
      const pdfClient: PdfDevisClient = {
        name: clientData?.name ?? "—",
        address: (clientData as any)?.address ?? null,
        address_line2: (clientData as any)?.address_line2 ?? null,
        postal_code: (clientData as any)?.postal_code ?? null,
        city: (clientData as any)?.city ?? null,
        email: clientData?.email ?? null,
        phone: clientData?.phone ?? null,
      };
      
      // Récupérer les données complètes du véhicule
      let pdfVehicle: PdfDevisVehicle = {
        brand: null,
        model: null,
        registration: null,
        vin: null,
      };
      if (vehicleId) {
        const vehicleData = await getVehicleById(vehicleId);
        if (vehicleData) {
          pdfVehicle = {
            brand: vehicleData.brand ?? null,
            model: vehicleData.model ?? null,
            registration: vehicleData.registration ?? null,
            vin: (vehicleData as any)?.vin ?? null,
          };
        }
      }
      
      // Récupérer les données garage complètes
      const garageId = garage?.id ?? ctxGarage?.id;
      const garageData = garageId ? await getGarageDataForPdf(garageId) : null;
      
      const payload: PdfDevisPayload = {
        reference: reference?.trim() || `Devis-${quote.id.slice(0, 8)}`,
        createdAt: quote.created_at ? new Date(quote.created_at).toLocaleDateString("fr-FR") : null,
        validUntil: validUntil || new Date().toISOString().slice(0, 10),
        client: pdfClient,
        vehicle: pdfVehicle,
        garage: garageData,
        vatRate: settings?.vat_rate ?? 20,
        pdfFooter: garageData?.pdfFooter ?? null,
        quoteValidDays: settings?.quote_valid_days ?? 30,
        lines: lines.map((l) => {
          const type = (l.type === "labor" || l.type === "part" || l.type === "forfait" ? l.type : "part") as "labor" | "part" | "forfait";
          return {
            type,
            typeLabel: LINE_TYPE_LABELS[type] ?? "Pièce",
            description: l.description ?? "",
            quantity: l.quantity ?? 0,
            unitPrice: l.unit_price ?? 0,
            totalHt: l.total ?? 0,
          };
        }),
        totalHt,
        totalTva,
        totalTtc,
        notesClient: notesClient?.trim() || null,
        clientExplanation: clientExplanationForPdf?.trim() || null,
        issuedAt: new Date().toLocaleDateString("fr-FR"),
        documentType: "devis",
      };
      const bytes = await generateDevisPdf(payload);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `devis-${payload.reference.replace(/\s/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (!silent) toast.success("PDF téléchargé.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération du PDF.");
    }
  }

  async function handleDownloadFacturePdf() {
    if (lines.length === 0) {
      toast.error("Ajoutez au moins une ligne au devis avant de générer la facture.");
      return;
    }
    if (status !== "accepted") {
      toast.error("Seuls les devis acceptés peuvent être transformés en facture.");
      return;
    }
    try {
      const res = await getOrCreateQuoteFactureNumber(quote.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (!res.factureNumber) {
        toast.error("Impossible de générer le numéro de facture.");
        return;
      }
      // Récupérer les données complètes du client
      const clientData = await getClientById(clientId);
      const pdfClient: PdfDevisClient = {
        name: clientData?.name ?? "—",
        address: (clientData as any)?.address ?? null,
        address_line2: (clientData as any)?.address_line2 ?? null,
        postal_code: (clientData as any)?.postal_code ?? null,
        city: (clientData as any)?.city ?? null,
        email: clientData?.email ?? null,
        phone: clientData?.phone ?? null,
      };
      
      // Récupérer les données complètes du véhicule
      let pdfVehicle: PdfDevisVehicle = {
        brand: null,
        model: null,
        registration: null,
        vin: null,
      };
      if (vehicleId) {
        const vehicleData = await getVehicleById(vehicleId);
        if (vehicleData) {
          pdfVehicle = {
            brand: vehicleData.brand ?? null,
            model: vehicleData.model ?? null,
            registration: vehicleData.registration ?? null,
            vin: (vehicleData as any)?.vin ?? null,
          };
        }
      }
      
      // Récupérer les données garage complètes
      const garageId = garage?.id ?? ctxGarage?.id;
      const garageData = garageId ? await getGarageDataForPdf(garageId) : null;
      
      // Calculer la date d'échéance
      let dueDate: string | null = null;
      if (settings?.payment_delay_days) {
        const issuedDate = new Date();
        issuedDate.setDate(issuedDate.getDate() + settings.payment_delay_days);
        dueDate = issuedDate.toISOString().slice(0, 10);
      }
      
      const payload: PdfDevisPayload = {
        reference: reference?.trim() || `Devis-${quote.id.slice(0, 8)}`,
        createdAt: quote.created_at ? new Date(quote.created_at).toLocaleDateString("fr-FR") : null,
        validUntil: validUntil || new Date().toISOString().slice(0, 10),
        client: pdfClient,
        vehicle: pdfVehicle,
        garage: garageData,
        vatRate: settings?.vat_rate ?? 20,
        pdfFooter: garageData?.pdfFooter ?? null,
        quoteValidDays: settings?.quote_valid_days ?? 30,
        lines: lines.map((l) => {
          const type = (l.type === "labor" || l.type === "part" || l.type === "forfait" ? l.type : "part") as "labor" | "part" | "forfait";
          return {
            type,
            typeLabel: LINE_TYPE_LABELS[type] ?? "Pièce",
            description: l.description ?? "",
            quantity: l.quantity ?? 0,
            unitPrice: l.unit_price ?? 0,
            totalHt: l.total ?? 0,
          };
        }),
        totalHt,
        totalTva,
        totalTtc,
        notesClient: notesClient?.trim() || null,
        clientExplanation: clientExplanationForPdf?.trim() || null,
        issuedAt: new Date().toLocaleDateString("fr-FR"),
        documentType: "facture",
        factureNumber: res.factureNumber,
        paymentStatus: (quote as any)?.payment_status ?? "unpaid",
        paymentDate: (quote as any)?.payment_date ?? null,
        paymentMethod: (quote as any)?.payment_method ?? null,
        dueDate,
      };
      // Validation des données avant génération
      if (!payload.lines || payload.lines.length === 0) {
        toast.error("Le devis doit contenir au moins une ligne.");
        return;
      }
      if (typeof payload.totalHt !== "number" || typeof payload.totalTva !== "number" || typeof payload.totalTtc !== "number") {
        toast.error("Erreur : les totaux ne sont pas valides.");
        return;
      }
      
      const bytes = await generateDevisPdf(payload);
      if (!bytes || bytes.length === 0) {
        toast.error("Erreur : le PDF généré est vide.");
        return;
      }
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture-${res.factureNumber.replace(/\s/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Facture PDF téléchargée.");
    } catch (e) {
      console.error("Erreur génération facture PDF:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error("Détails de l'erreur:", {
        error: e,
        message: errorMessage,
        stack: e instanceof Error ? e.stack : undefined,
      });
      toast.error(`Erreur lors de la génération de la facture${errorMessage ? ` : ${errorMessage}` : "."}`);
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6">
      <ConfirmDialog
        variant="delete"
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        loading={actionLoading}
      />
      <ConfirmDialog
        variant="decline"
        open={declineModalOpen}
        onOpenChange={setDeclineModalOpen}
        onConfirm={handleConfirmDecline}
        loading={actionLoading}
      />
      <QuoteExplainDrawer
        open={explainDrawerOpen}
        onOpenChange={setExplainDrawerOpen}
        quoteId={quote.id}
        lines={lines}
        totalHt={totalHt}
        totalTva={totalTva}
        totalTtc={totalTtc}
        durationEstimate={getDurationEstimate(lines)}
        onAddToPdf={(text) => setClientExplanationForPdf(text)}
        onAddToEmail={(text) => setClientExplanationForEmail(text)}
      />
      <ClientMessageDrawer
        open={clientMessageDrawerOpen}
        onOpenChange={setClientMessageDrawerOpen}
        context={{
          clientName: clients.find((c) => c.id === clientId)?.name ?? "",
          vehicleLabel: (() => {
            const v = allVehicles.find((ve) => ve.id === vehicleId);
            return v ? [v.brand, v.model].filter(Boolean).join(" ") || v.registration || undefined : undefined;
          })(),
          quoteRef: reference?.trim() || undefined,
          totalTtc,
          validUntil: validUntil?.trim() || null,
        }}
        clientEmail={clients.find((c) => c.id === clientId)?.email}
        clientPhone={clients.find((c) => c.id === clientId)?.phone}
      />
      
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
      {/* Colonne principale : Contenu du devis */}
      <div className="flex-1 min-w-0 space-y-6 lg:space-y-8">
        {/* Résumé de l'intervention */}
        {lines.length > 0 && <QuoteSummaryCard lines={lines} />}

        {/* Informations générales */}
        <Card className="rounded-[20px] border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-250 ease-out">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="flex items-center justify-between text-foreground">
              <span className="text-xl font-bold">{reference?.trim() ? reference : (quote.reference?.trim() ? quote.reference : `Devis #${quote.id.slice(0, 8)}`)}</span>
              <StatusBadge status={status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">Client</Label>
                  {isDraft && (
                    <Link href="/dashboard/clients/new">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary"
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Nouveau client
                      </Button>
                    </Link>
                  )}
                </div>
                <div className="space-y-1">
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    disabled={!isDraft}
                    className="flex h-10 w-full rounded-input border border-border bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name ?? "—"}</option>
                    ))}
                  </select>
                  {clients.length === 0 && isDraft && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertCircle className="h-3 w-3" />
                      Aucun client disponible.{" "}
                      <Link href="/dashboard/clients/new" className="text-primary hover:underline">
                        Créer le premier client
                      </Link>
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-foreground">Véhicule</Label>
                  {isDraft && (
                    <Link href={`/dashboard/vehicles/new${clientId ? `?client_id=${clientId}` : ""}`}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary"
                      >
                        <Car className="h-3 w-3 mr-1" />
                        Nouveau véhicule
                      </Button>
                    </Link>
                  )}
                </div>
                <div className="space-y-1">
                  <select
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                    disabled={!isDraft}
                    className="flex h-10 w-full rounded-input border border-border bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    <option value="">—</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.registration} {v.brand} {v.model}
                      </option>
                    ))}
                  </select>
                  {vehicles.length === 0 && clientId && isDraft && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <AlertCircle className="h-3 w-3" />
                      Aucun véhicule pour ce client.{" "}
                      <Link href={`/dashboard/vehicles/new?client_id=${clientId}`} className="text-primary hover:underline">
                        Ajouter un véhicule
                      </Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Valide jusqu&apos;au</Label>
                <Input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  disabled={!isDraft}
                  className="rounded-input disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Statut</Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={!isDraft}
                  className="flex h-10 w-full rounded-input border border-border bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <option value="draft">Brouillon</option>
                  <option value="sent">Envoyé</option>
                  <option value="accepted">Accepté</option>
                  <option value="declined">Refusé</option>
                  <option value="expired">Expiré</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Date prévue (RDV)</Label>
              <Input
                type="date"
                value={plannedAt}
                onChange={(e) => setPlannedAt(e.target.value)}
                className="rounded-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Référence métier</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex. 2026-003"
                disabled={!isDraft}
                className="rounded-input disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Notes internes (garage)</Label>
              <p className="text-xs text-muted-foreground">Visible uniquement par le garage, jamais sur le PDF.</p>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes internes…"
                disabled={!isDraft}
                className="rounded-input disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground">Notes client (sur PDF)</Label>
              <p className="text-xs text-muted-foreground">Affichées sur le devis envoyé au client.</p>
              <Input
                value={notesClient}
                onChange={(e) => setNotesClient(e.target.value)}
                placeholder="Message pour le client…"
                disabled={!isDraft}
                className="rounded-input disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
              />
            </div>
          </CardContent>
        </Card>

        {/* Bloc IA - Accent card */}
        {isDraft && (
          <Card className="rounded-[20px] border border-primary/30 bg-primary/10 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-250 ease-out">
            <CardHeader className="pb-4 border-b border-primary/20">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Génération IA de lignes de devis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Décris l&apos;intervention (texte ou voix)</Label>
                <p className="text-xs text-muted-foreground">Exemple : &quot;Clio 4, plaquettes avant + vidange, environ 2h&quot;</p>
                <div className="flex gap-2">
                  <textarea
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                    placeholder="Décrivez l'intervention à réaliser..."
                    disabled={aiLoading}
                    rows={3}
                    className="flex-1 min-w-0 rounded-input border border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200"
                  />
                  {hasSpeech && (
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "outline"}
                      size="icon"
                      className="shrink-0 self-stretch rounded-input border-border w-12"
                      onClick={isListening ? stopSpeech : startSpeech}
                      disabled={aiLoading}
                      title={isListening ? "Arrêter la prise de parole" : "Parler (retranscription vocale)"}
                      aria-label={isListening ? "Arrêter l'enregistrement" : "Parler pour retranscrire"}
                    >
                      {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    </Button>
                  )}
                </div>
              </div>
              <Button
                onClick={handleAiGenerate}
                disabled={aiLoading || !aiDescription.trim()}
                className="w-full rounded-button bg-primary text-primary-foreground font-semibold shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyse de l&apos;intervention...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Proposer le devis (IA)
                  </>
                )}
              </Button>
              {aiLoading && (
                <p className="text-xs text-muted-foreground text-center">L&apos;IA analyse votre demande...</p>
              )}
              {!aiLoading && (
                <p className="text-xs text-muted-foreground text-center">
                  💡 Les lignes générées sont <strong className="text-foreground">entièrement modifiables</strong> : vous pouvez ajuster les prix, quantités et descriptions selon vos besoins.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contrôle IA - Analyse incohérences et corrections en 1 clic */}
        {isDraft && (
          <div className="max-w-[1200px] mx-auto">
            <QuoteAuditPanel
              quoteId={quote.id}
              lines={lines}
              hourlyRate={hourlyRate}
              autoTrigger={true}
              onApplyFix={(nextLines) => {
                setLines(nextLines);
                const ht = nextLines.reduce((s, l) => s + l.total, 0);
                const tva = Math.round(ht * vatRateDecimal * 100) / 100;
                const ttc = Math.round((ht + tva) * 100) / 100;
                setTotalHt(ht);
                setTotalTva(tva);
                setTotalTtc(ttc);
              }}
            />
          </div>
        )}

        {/* Tableau lignes - Carte principale centrée */}
        <div className="max-w-[1200px] mx-auto">
          <Card className="rounded-[16px] border border-border/40 bg-card shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <DevisLineEditor
                lines={lines}
                onChange={(next, ht, ttc) => {
                  setLines(next);
                  setTotalHt(ht);
                  setTotalTtc(ttc);
                }}
                readOnly={!isDraft}
                confirmBeforeRemove
                vatRateDecimal={vatRateDecimal}
              />
            </CardContent>
          </Card>
        </div>

        {/* Bloc total final - Zone business distincte */}
        <div className="max-w-[1200px] mx-auto mt-8">
          <Card className="rounded-[16px] border border-border/40 bg-card shadow-sm">
            <CardContent className="py-8 px-8">
              <div className="flex flex-col items-end gap-6">
                {/* Totaux HT et TVA (secondaires) */}
                <div className="flex flex-wrap items-baseline justify-end gap-8 text-base w-full">
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground/70 mb-1 font-medium">Total HT</span>
                    <span className="text-xl font-semibold text-foreground tabular-nums">{totalHt.toFixed(2)} €</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-muted-foreground/70 mb-1 font-medium">TVA (20%)</span>
                    <span className="text-xl font-semibold text-foreground tabular-nums">{totalTva.toFixed(2)} €</span>
                  </div>
                </div>
                
                {/* Séparateur */}
                <div className="w-full border-t border-border/30" />
                
                {/* TOTAL TTC - Élément principal */}
                <div className="text-right w-full pt-4">
                  <div className="mb-2">
                    <span className="text-sm font-semibold text-foreground">
                      Montant total à régler (TTC)
                    </span>
                  </div>
                  <div className={`text-5xl font-bold text-primary tabular-nums mb-3 transition-all duration-200 ease-out ${
                    totalChanged ? "scale-[1.02]" : "scale-100"
                  }`}>
                    {totalTtc.toFixed(2)} €
                  </div>
                  <p className="text-xs text-muted-foreground/60">
                    TVA incluse · Aucun frais caché
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Colonne droite : Actions sticky */}
      <aside className="w-full lg:w-80 shrink-0">
        <div className="lg:sticky lg:top-6 space-y-4">
          <Card className="rounded-[20px] border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg p-6">
            <h3 className="text-sm font-semibold text-foreground mb-5">Actions</h3>
            <div className="space-y-3">
              {/* BOUTON PRINCIPAL - Envoyer le devis au client */}
              <Button
                className="w-full rounded-[12px] bg-primary text-primary-foreground font-bold shadow-lg hover:shadow-xl hover:bg-primary/90 transition-all duration-250 ease-out disabled:opacity-50 h-12 text-base"
                onClick={handleSendToClient}
                disabled={!canSend}
              >
                <Send className="h-5 w-5 mr-2" />
                Envoyer le devis au client
              </Button>
              
              <div className="pt-2 border-t border-border" />
              
              {/* Actions secondaires */}
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-button border-border text-foreground hover:bg-muted transition-all duration-200 h-10"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-button transition-all duration-200 h-10"
                onClick={() => handleDownloadPdf()}
                disabled={lines.length === 0}
              >
                <FileDown className="h-4 w-4 mr-2" />
                Télécharger PDF devis
              </Button>
              {status === "accepted" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-button border-success/50 text-success hover:bg-success/10 transition-all duration-200 h-10"
                  onClick={() => handleDownloadFacturePdf()}
                  disabled={lines.length === 0}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  Générer la facture (PDF)
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-button transition-all duration-200 h-10"
                onClick={() => setExplainDrawerOpen(true)}
                disabled={lines.length === 0}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Expliquer au client
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-button transition-all duration-200 h-10"
                onClick={() => setClientMessageDrawerOpen(true)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Générer message
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full rounded-button transition-all duration-200 h-10" 
                onClick={handleDuplicate}
              >
                <Copy className="h-4 w-4 mr-2" />
                Dupliquer devis
              </Button>
              
              {(status === "sent" || status === "draft") && (
                <>
                  <div className="pt-2 border-t border-border" />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full rounded-button bg-success/10 text-success border-success/30 hover:bg-success/20 transition-all duration-200 h-10" 
                    onClick={() => handleStatus("accepted")}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Marquer accepté
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full rounded-button bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20 transition-all duration-200 h-10" 
                    onClick={() => setDeclineModalOpen(true)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Marquer refusé
                  </Button>
                </>
              )}
              
              <div className="pt-2 border-t border-border" />
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full rounded-button border-destructive/30 text-destructive hover:bg-destructive/10 transition-all duration-200 h-10" 
                onClick={() => setDeleteModalOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </div>
          </Card>
          <div className="text-xs text-muted-foreground px-1 space-y-1">
            <p>
              Créé le {quote.created_at ? new Date(quote.created_at).toLocaleDateString("fr-FR") : "—"}
            </p>
            {validUntil && (
              <p>
                Valide jusqu&apos;au {new Date(validUntil).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
}
