/**
 * Structure pour la génération PDF du devis.
 * Données à fournir au moteur de rendu PDF.
 */

export type PdfDevisLine = {
  type: "labor" | "part" | "forfait";
  typeLabel: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalHt: number;
};

/** Infos garage pour le header du PDF */
export type PdfDevisGarage = {
  name: string | null;
  address: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  siret?: string | null;
  /** URL publique du logo (affiché en en-tête du PDF) */
  logo_url?: string | null;
  /** TVA intracommunautaire */
  vat_intracom?: string | null;
  /** Conditions de paiement */
  payment_terms?: string | null;
  /** Délai de règlement en jours */
  payment_delay_days?: number | null;
  /** Mentions légales personnalisées */
  legal_mentions?: string | null;
  /** Pénalités de retard */
  late_payment_penalties?: string | null;
  /** IBAN pour paiements */
  iban?: string | null;
  /** BIC pour paiements */
  bic?: string | null;
  /** Thème du garage pour adaptation des couleurs */
  theme_primary?: string | null;
  theme_accent?: string | null;
  theme_mode?: string | null;
  theme_surface?: string | null;
  theme_text?: string | null;
  pdf_style?: string | null;
  /** Texte personnalisé du footer (depuis custom_settings.appearance.footer_text ou pdf_footer) */
  pdfFooter?: string | null;
};

/** Infos client complètes pour le PDF */
export type PdfDevisClient = {
  name: string;
  address?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
};

/** Infos véhicule complètes pour le PDF */
export type PdfDevisVehicle = {
  brand?: string | null;
  model?: string | null;
  registration?: string | null;
  vin?: string | null;
};

export type PdfDevisPayload = {
  /** Référence métier (ex. 2026-003) ou id court */
  reference: string;
  /** Date de création du devis (affichage) */
  createdAt?: string | null;
  /** Date de validité du devis */
  validUntil: string;
  /** Client complet (remplace clientName) */
  client: PdfDevisClient;
  /** Véhicule complet (remplace vehicleLabel et vehicleRegistration) */
  vehicle: PdfDevisVehicle;
  /** Lignes d'intervention */
  lines: PdfDevisLine[];
  /** Total HT */
  totalHt: number;
  /** Montant TVA */
  totalTva: number;
  /** Total TTC */
  totalTtc: number;
  /** Notes visibles sur le PDF (notes client uniquement) */
  notesClient: string | null;
  /** Explication simple pour le client (section "En résumé pour vous", optionnel) */
  clientExplanation?: string | null;
  /** Date d'émission (footer) */
  issuedAt: string;
  /** Infos garage pour header */
  garage?: PdfDevisGarage | null;
  /** Taux de TVA (0–100) pour le libellé (ex. 20 → "TVA 20 %") */
  vatRate?: number;
  /** Texte personnalisé du footer ; si absent, texte par défaut avec quoteValidDays */
  pdfFooter?: string | null;
  /** Nombre de jours de validité pour le texte par défaut du footer */
  quoteValidDays?: number;
  /** Type de document : devis, facture ou avoir */
  documentType?: "devis" | "facture" | "avoir";
  /** Numéro de facture (affiché si documentType === "facture") */
  factureNumber?: string | null;
  /** Numéro d'avoir (affiché si documentType === "avoir") */
  creditNoteNumber?: string | null;
  /** Statut de paiement pour les factures */
  paymentStatus?: "unpaid" | "partial" | "paid";
  /** Date de paiement */
  paymentDate?: string | null;
  /** Mode de paiement */
  paymentMethod?: string | null;
  /** Date d'échéance (calculée à partir de issuedAt + payment_delay_days) */
  dueDate?: string | null;
};
