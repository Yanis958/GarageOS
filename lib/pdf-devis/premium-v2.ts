/**
 * Moteur PDF Premium V2 - Ultra Pro / Haut de Gamme / SaaS Enterprise
 *
 * - Zéro superposition garantie
 * - Hiérarchie visuelle claire (nom garage, n° facture/devis, client, véhicule, TOTAL TTC en gras)
 * - Thème caméléon par garage
 * - Pagination robuste
 * - Typographie : Inter (embarquée) si disponible, sinon Helvetica
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, RGB } from "pdf-lib";
import type { PdfDevisPayload, PdfDevisGarage } from "./types";

const INTER_REGULAR_URL = "https://unpkg.com/@fontsource/inter@5.0.8/files/inter-latin-400-normal.ttf";
const INTER_BOLD_URL = "https://unpkg.com/@fontsource/inter@5.0.8/files/inter-latin-700-normal.ttf";

async function loadPdfFonts(doc: PDFDocument): Promise<{ font: PDFFont; fontBold: PDFFont }> {
  try {
    const [regularRes, boldRes] = await Promise.all([
      fetch(INTER_REGULAR_URL, { cache: "force-cache" }),
      fetch(INTER_BOLD_URL, { cache: "force-cache" }),
    ]);
    if (regularRes.ok && boldRes.ok) {
      const [regularBytes, boldBytes] = await Promise.all([
        regularRes.arrayBuffer(),
        boldRes.arrayBuffer(),
      ]);
      const font = await doc.embedFont(new Uint8Array(regularBytes));
      const fontBold = await doc.embedFont(new Uint8Array(boldBytes));
      return { font, fontBold };
    }
  } catch (e) {
    console.warn("PDF: police Inter non chargée, utilisation de Helvetica.", e);
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  return { font, fontBold };
}

// ============================================================================
// CONSTANTES GLOBALES - GRILLE FIXE
// ============================================================================

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 50; // Marges généreuses pour respiration premium
const MARGIN_Y = 50;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;

// Typographie professionnelle (Helvetica = standard PDF, très lisible)
const FONT_SIZE_H1 = 32; // "FACTURE" - très lisible
const FONT_SIZE_H2 = 16; // Sous-titres sections
const FONT_SIZE_H3 = 12; // Labels (CLIENT, VÉHICULE)
const FONT_SIZE_BODY = 10; // Corps de texte
const FONT_SIZE_SMALL = 9; // Textes secondaires
const FONT_SIZE_TINY = 7; // Footer

const LINE_HEIGHT_H1 = 38;
const LINE_HEIGHT_H2 = 20;
const LINE_HEIGHT_BODY = 14;
const LINE_HEIGHT_COMPACT = 12;

// Espacements généreux (respiration visuelle)
const SPACE_XS = 4;
const SPACE_SM = 8;
const SPACE_MD = 16;
const SPACE_LG = 24;
const SPACE_XL = 32;

// Logo/Monogramme
const LOGO_MAX_WIDTH = 120;
const LOGO_MAX_HEIGHT = 50;
const MONOGRAM_SIZE = 48;

// Tableau - Largeurs pour rester à gauche du bloc totaux (TOTALS_BOX_X = 285, donc table ≤ 235)
const TABLE_COL_TYPE_W = 28; // Réduit pour donner plus d'espace aux autres colonnes
const TABLE_COL_DESC_W = 70; // Réduit pour laisser plus d'espace aux colonnes numériques
const TABLE_COL_QTY_W = 22;
const TABLE_COL_PU_W = 50; // Augmenté pour éviter le chevauchement (ex: "50,00 EUR")
const TABLE_COL_TOTAL_W = 50; // Augmenté pour éviter le chevauchement
const TABLE_SPACING = SPACE_SM; // 8px entre chaque colonne
const TABLE_TOTAL_WIDTH = TABLE_COL_TYPE_W + TABLE_COL_DESC_W + TABLE_COL_QTY_W + TABLE_COL_PU_W + TABLE_COL_TOTAL_W + (TABLE_SPACING * 4);

// Bloc totaux - Zone forte
const TOTALS_BOX_WIDTH = 260;
const TOTALS_BOX_X = PAGE_WIDTH - MARGIN_X - TOTALS_BOX_WIDTH;
const TOTALS_BOX_PADDING = SPACE_MD;

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type PdfThemeV2 = {
  // Couleurs du garage (adaptatives)
  primary: RGB;
  primary_light: RGB; // 10-15% opacité pour fond header table
  primary_dark: RGB;
  
  // Couleurs neutres (toujours lisibles)
  text: RGB; // Noir pour texte principal
  text_secondary: RGB; // Gris moyen pour textes secondaires
  text_muted: RGB; // Gris clair pour textes discrets
  border: RGB; // Gris moyen pour bordures
  border_light: RGB; // Gris très clair pour bordures subtiles
  background: RGB; // Blanc
  surface: RGB; // Blanc cassé pour cards
  zebra: RGB; // Gris très clair pour lignes alternées (10-15% gris)
  
  // Couleurs sémantiques
  success: RGB;
  warning: RGB;
  danger: RGB;
};

type PdfLayoutState = {
  currentPage: PDFPage;
  y: number;
  pageNumber: number;
  totalPages: number;
};

// ============================================================================
// HELPERS UTILITAIRES
// ============================================================================

function cleanTextForWinAnsi(text: string | null | undefined): string {
  if (!text) return text || "";
  let cleaned = String(text);
  
  cleaned = cleaned.replace(/€/g, "EUR");
  cleaned = cleaned
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\u2009/g, " ")
    .replace(/[\u2000-\u200B\u2028-\u202F]/g, " ");
  
  // Accents français
  cleaned = cleaned
    .replace(/\u00E0/g, "a").replace(/\u00E1/g, "a").replace(/\u00E2/g, "a").replace(/\u00E4/g, "a")
    .replace(/\u00E8/g, "e").replace(/\u00E9/g, "e").replace(/\u00EA/g, "e").replace(/\u00EB/g, "e")
    .replace(/\u00EC/g, "i").replace(/\u00ED/g, "i").replace(/\u00EE/g, "i").replace(/\u00EF/g, "i")
    .replace(/\u00F2/g, "o").replace(/\u00F3/g, "o").replace(/\u00F4/g, "o").replace(/\u00F6/g, "o")
    .replace(/\u00F9/g, "u").replace(/\u00FA/g, "u").replace(/\u00FB/g, "u").replace(/\u00FC/g, "u")
    .replace(/\u00E7/g, "c").replace(/\u00C7/g, "C")
    .replace(/\u0153/g, "oe").replace(/\u0152/g, "OE")
    .replace(/\u00E6/g, "ae").replace(/\u00C6/g, "AE");
  
  // Caractères spéciaux
  cleaned = cleaned
    .replace(/\u2011/g, "-").replace(/\u2013/g, "-").replace(/\u2014/g, "-")
    .replace(/\u2018/g, "'").replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
    .trim();
  
  return cleaned;
}

function formatMoney(amount: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return cleanTextForWinAnsi(formatted.replace(/\u202F/g, " ")) + " EUR";
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatHours(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes} min`;
  }
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) {
    return `${wholeHours} h`;
  }
  return `${wholeHours}h${minutes.toString().padStart(2, "0")}`;
}

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  font: PDFFont
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    
    if (width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines.length > 0 ? lines : [text];
}

// ============================================================================
// GÉNÉRATION THÈME CAMÉLÉON
// ============================================================================

function generatePdfThemeV2(garage: {
  theme_primary?: string | null;
  theme_accent?: string | null;
}): PdfThemeV2 {
  // Convertir hex en RGB avec fallback
  function hexToRgbSafe(hex: string | null | undefined): RGB {
    if (!hex || typeof hex !== "string" || hex.trim() === "") {
      return rgb(0.1, 0.1, 0.1); // Noir par défaut
    }
    
    const cleanHex = hex.replace("#", "").trim();
    if (cleanHex.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
      return rgb(0.1, 0.1, 0.1);
    }
    
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return rgb(0.1, 0.1, 0.1);
    }
    
    return rgb(r / 255, g / 255, b / 255);
  }
  
  // Design sobre : utiliser la couleur du garage uniquement pour accents
  const primary = hexToRgbSafe(garage.theme_primary);
  
  // Extraire composantes RGB pour créer variantes
  function getRgbComponents(color: RGB): { r: number; g: number; b: number } {
    if (garage.theme_primary && typeof garage.theme_primary === "string") {
      const cleanHex = garage.theme_primary.replace("#", "").trim();
      if (cleanHex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
        return {
          r: parseInt(cleanHex.substring(0, 2), 16) / 255,
          g: parseInt(cleanHex.substring(2, 4), 16) / 255,
          b: parseInt(cleanHex.substring(4, 6), 16) / 255,
        };
      }
    }
    return { r: 0.1, g: 0.1, b: 0.1 };
  }
  
  const components = getRgbComponents(primary);
  // Luminance (approximative) : éviter fond noir et couleurs trop sombres
  const luminance = 0.299 * components.r + 0.587 * components.g + 0.114 * components.b;
  const primaryAdjusted =
    luminance < 0.15
      ? rgb(
          Math.min(1, components.r + 0.25),
          Math.min(1, components.g + 0.25),
          Math.min(1, components.b + 0.25)
        )
      : primary;

  const primary_light = rgb(
    Math.min(1, components.r * 0.12 + 0.88),
    Math.min(1, components.g * 0.12 + 0.88),
    Math.min(1, components.b * 0.12 + 0.88)
  );
  const primary_dark = rgb(
    Math.max(0, components.r - 0.2),
    Math.max(0, components.g - 0.2),
    Math.max(0, components.b - 0.2)
  );

  return {
    primary: primaryAdjusted,
    primary_light,
    primary_dark,
    text: rgb(0.1, 0.1, 0.1),
    text_secondary: rgb(0.4, 0.4, 0.4),
    text_muted: rgb(0.6, 0.6, 0.6),
    border: rgb(0.75, 0.75, 0.75),
    border_light: rgb(0.9, 0.9, 0.9),
    background: rgb(1, 1, 1), // Toujours clair (interdit fond noir)
    surface: rgb(0.98, 0.98, 0.98),
    zebra: rgb(0.97, 0.97, 0.97),
    success: rgb(0.2, 0.7, 0.3),
    warning: rgb(0.95, 0.65, 0.1),
    danger: rgb(0.9, 0.2, 0.2),
  };
}

// ============================================================================
// GESTION PAGINATION ROBUSTE
// ============================================================================

function ensurePageSpace(
  doc: PDFDocument,
  state: PdfLayoutState,
  requiredHeight: number,
  font: PDFFont,
  fontBold: PDFFont,
  theme: PdfThemeV2
): PdfLayoutState {
  const minY = MARGIN_Y + 100; // Espace minimum pour footer + marge
  
  if (state.y - requiredHeight < minY) {
    // Nouvelle page nécessaire
    const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    state.currentPage = newPage;
    state.y = PAGE_HEIGHT - MARGIN_Y;
    state.pageNumber++;
    state.totalPages = doc.getPageCount();
    
    // Dessiner header de table sur nouvelle page
    drawTableHeader(newPage, state.y, font, fontBold, theme);
    state.y -= 35; // Hauteur header + espace
    
    return state;
  }
  
  return state;
}

// ============================================================================
// HEADER - Logo/Monogramme + Infos Garage
// ============================================================================

async function drawHeaderV2(
  doc: PDFDocument,
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  theme: PdfThemeV2
): Promise<number> {
  let y = PAGE_HEIGHT - MARGIN_Y;
  
  // Logo ou monogramme à gauche
  const logoX = MARGIN_X;
  let logoHeight = 0;
  
  if (data.garage?.logo_url?.trim()) {
    try {
      const res = await fetch(data.garage.logo_url, { mode: "cors" });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "";
        let image;
        if (contentType.includes("png")) {
          image = await doc.embedPng(bytes);
        } else {
          image = await doc.embedJpg(bytes);
        }
        const w = image.width;
        const h = image.height;
        if (w > 0 && h > 0) {
          const scale = Math.min(LOGO_MAX_WIDTH / w, LOGO_MAX_HEIGHT / h, 1);
          const drawWidth = w * scale;
          logoHeight = h * scale;
          page.drawImage(image, {
            x: logoX,
            y: y - logoHeight,
            width: drawWidth,
            height: logoHeight,
          });
        }
      }
    } catch (error) {
      console.warn("Erreur chargement logo:", error);
    }
  }
  
  // Monogramme si pas de logo
  if (logoHeight === 0) {
    const garageName = data.garage?.name || "G";
    const initials = garageName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    
    // Cercle avec bordure (style sobre)
    page.drawCircle({
      x: logoX + MONOGRAM_SIZE / 2,
      y: y - MONOGRAM_SIZE / 2,
      size: MONOGRAM_SIZE / 2,
      borderColor: theme.border,
      borderWidth: 2,
    });
    
    // Initiales
    const fontSize = 18;
    const textWidth = fontBold.widthOfTextAtSize(initials, fontSize);
    page.drawText(cleanTextForWinAnsi(initials), {
      x: logoX + MONOGRAM_SIZE / 2 - textWidth / 2,
      y: y - MONOGRAM_SIZE / 2 - fontSize / 3,
      size: fontSize,
      font: fontBold,
      color: theme.text,
    });
    logoHeight = MONOGRAM_SIZE;
  }
  
  // Infos garage à droite (alignées à droite)
  const rightX = PAGE_WIDTH - MARGIN_X;
  const garageName = data.garage?.name?.trim() || "Garage";
  
  // Nom garage (GRAS)
  page.drawText(cleanTextForWinAnsi(garageName), {
    x: rightX - fontBold.widthOfTextAtSize(garageName, FONT_SIZE_H2),
    y,
    size: FONT_SIZE_H2,
    font: fontBold,
    color: theme.text,
  });
  let infoY = y - LINE_HEIGHT_H2 - SPACE_XS;
  
  // Coordonnées (secondaire)
  const garageLines: string[] = [];
  if (data.garage?.address_line1?.trim()) {
    garageLines.push(data.garage.address_line1.trim());
  }
  if (data.garage?.address_line2?.trim()) {
    garageLines.push(data.garage.address_line2.trim());
  }
  if (data.garage?.postal_code && data.garage?.city) {
    garageLines.push(`${data.garage.postal_code} ${data.garage.city}`);
  } else if (data.garage?.postal_code) {
    garageLines.push(data.garage.postal_code);
  } else if (data.garage?.city) {
    garageLines.push(data.garage.city);
  }
  if (data.garage?.phone?.trim()) {
    garageLines.push(`Tel. ${data.garage.phone.trim()}`);
  }
  if (data.garage?.email?.trim()) {
    garageLines.push(data.garage.email.trim());
  }
  if (data.garage?.siret?.trim()) {
    garageLines.push(`SIRET ${data.garage.siret.trim()}`);
  }
  if (data.garage?.vat_intracom?.trim()) {
    garageLines.push(`TVA ${data.garage.vat_intracom.trim()}`);
  }
  
  for (const line of garageLines) {
    page.drawText(cleanTextForWinAnsi(line), {
      x: rightX - font.widthOfTextAtSize(line, FONT_SIZE_SMALL),
      y: infoY,
      size: FONT_SIZE_SMALL,
      font,
      color: theme.text_secondary,
    });
    infoY -= LINE_HEIGHT_COMPACT;
  }
  
  // Ajuster y selon logo ou contenu
  const contentHeight = Math.max(logoHeight, garageLines.length * LINE_HEIGHT_COMPACT + LINE_HEIGHT_H2 + SPACE_XS);
  y = PAGE_HEIGHT - MARGIN_Y - contentHeight - SPACE_LG;
  
  // Ligne de séparation fine (couleur primaire du garage)
  y -= SPACE_MD;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 1,
    color: theme.primary, // Couleur primaire du garage
  });
  y -= SPACE_LG;
  
  return y;
}

// ============================================================================
// TITRE FACTURE - "FACTURE" + Numéro + Dates
// ============================================================================

function drawDocumentTitle(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  theme: PdfThemeV2,
  startY: number
): number {
  let y = startY;
  
  const docType = data.documentType || "devis";
  const docTitle = docType === "facture" ? "FACTURE" : docType === "avoir" ? "AVOIR" : "DEVIS";
  
  // Titre principal "FACTURE" (TRÈS LISIBLE)
  page.drawText(docTitle, {
    x: MARGIN_X,
    y,
    size: FONT_SIZE_H1,
    font: fontBold,
    color: theme.text,
  });
  y -= LINE_HEIGHT_H1 + SPACE_MD;
  
  // Numéro de facture (GRAS)
  const docNumber =
    (docType === "facture" && data.factureNumber) ||
    (docType === "avoir" && data.creditNoteNumber) ||
    data.reference;
  
  const docNumberText = `N° ${docNumber}`;
  page.drawText(cleanTextForWinAnsi(docNumberText), {
    x: MARGIN_X,
    y,
    size: FONT_SIZE_H3,
    font: fontBold,
    color: theme.text,
  });
  
  // Dates alignées proprement (à droite du numéro)
  const dateX = MARGIN_X + fontBold.widthOfTextAtSize(docNumberText, FONT_SIZE_H3) + SPACE_LG;
  const dateInfo: string[] = [];
  if (data.createdAt) {
    dateInfo.push(`Créé le ${formatDate(data.createdAt)}`);
  }
  if (docType === "facture" || docType === "avoir") {
    if (data.issuedAt) {
      dateInfo.push(`Émis le ${formatDate(data.issuedAt)}`);
    }
    if (data.dueDate && docType === "facture") {
      dateInfo.push(`Échéance ${formatDate(data.dueDate)}`);
    }
  } else {
    if (data.validUntil) {
      dateInfo.push(`Valide jusqu'au ${formatDate(data.validUntil)}`);
    }
  }
  
  let dateY = y;
  for (const dateLine of dateInfo) {
    page.drawText(cleanTextForWinAnsi(dateLine), {
      x: dateX,
      y: dateY,
      size: FONT_SIZE_SMALL,
      font,
      color: theme.text_secondary,
    });
    dateY -= LINE_HEIGHT_COMPACT;
  }
  
  y = Math.min(y, dateY) - SPACE_LG;
  
  return y;
}

// ============================================================================
// BLOCS CLIENT / VÉHICULE - 2 Colonnes Équilibrées
// ============================================================================

function drawClientVehicleBlockV2(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  theme: PdfThemeV2,
  startY: number
): number {
  let y = startY;
  
  const cardWidth = (CONTENT_WIDTH - SPACE_MD) / 2;
  const cardPadding = SPACE_MD;
  const cardBorderWidth = 1;
  
  // Card Client (gauche)
  const clientCardX = MARGIN_X;
  let clientCardHeight = cardPadding * 2;
  
  // Header "CLIENT"
  page.drawText("CLIENT", {
    x: clientCardX + cardPadding,
    y,
    size: FONT_SIZE_H3,
    font: fontBold,
    color: theme.text,
  });
  clientCardHeight += LINE_HEIGHT_BODY + SPACE_XS;
  
  // Nom client (GRAS)
  const clientName = data.client.name || "—";
  let clientY = y - clientCardHeight;
  const clientNameLines = wrapText(
    cleanTextForWinAnsi(clientName),
    cardWidth - 2 * cardPadding,
    FONT_SIZE_BODY,
    fontBold
  );
  for (const line of clientNameLines.slice(0, 2)) {
    page.drawText(line, {
      x: clientCardX + cardPadding,
      y: clientY,
      size: FONT_SIZE_BODY,
      font: fontBold,
      color: theme.text,
    });
    clientY -= LINE_HEIGHT_BODY;
    clientCardHeight += LINE_HEIGHT_BODY;
  }
  clientCardHeight += SPACE_XS;
  
  // Email (gras pour visibilité)
  if (data.client.email) {
    clientY -= SPACE_XS;
    page.drawText(cleanTextForWinAnsi(data.client.email), {
      x: clientCardX + cardPadding,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: theme.text_secondary,
    });
    clientY -= LINE_HEIGHT_COMPACT;
    clientCardHeight += LINE_HEIGHT_COMPACT + SPACE_XS;
  }
  
  // Téléphone (gras pour visibilité)
  if (data.client.phone) {
    clientY -= SPACE_XS;
    page.drawText(cleanTextForWinAnsi(data.client.phone), {
      x: clientCardX + cardPadding,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: theme.text_secondary,
    });
    clientY -= LINE_HEIGHT_COMPACT;
    clientCardHeight += LINE_HEIGHT_COMPACT + SPACE_XS;
  }
  
  // Adresse
  const addressParts = [
    data.client.address,
    data.client.address_line2,
    data.client.postal_code && data.client.city
      ? `${data.client.postal_code} ${data.client.city}`
      : data.client.postal_code || data.client.city,
  ].filter(Boolean);
  
  if (addressParts.length > 0) {
    clientY -= SPACE_XS;
    const addressText = addressParts.join(", ");
    const addressLines = wrapText(
      cleanTextForWinAnsi(addressText),
      cardWidth - 2 * cardPadding,
      FONT_SIZE_SMALL,
      font
    );
    for (const line of addressLines.slice(0, 2)) {
      page.drawText(line, {
        x: clientCardX + cardPadding,
        y: clientY,
        size: FONT_SIZE_SMALL,
        font,
        color: theme.text_secondary,
      });
      clientY -= LINE_HEIGHT_COMPACT;
      clientCardHeight += LINE_HEIGHT_COMPACT;
    }
    clientCardHeight += SPACE_XS;
  }
  
  // Dessiner card Client (fond clair + bordure fine)
  page.drawRectangle({
    x: clientCardX,
    y: y - clientCardHeight,
    width: cardWidth,
    height: clientCardHeight,
    borderColor: theme.border,
    borderWidth: cardBorderWidth,
    color: theme.surface,
  });
  
  // Card Véhicule (droite)
  const vehicleCardX = MARGIN_X + cardWidth + SPACE_MD;
  let vehicleCardHeight = cardPadding * 2;
  
  // Header "VÉHICULE"
  page.drawText("VÉHICULE", {
    x: vehicleCardX + cardPadding,
    y,
    size: FONT_SIZE_H3,
    font: fontBold,
    color: theme.text,
  });
  vehicleCardHeight += LINE_HEIGHT_BODY + SPACE_XS;
  
  // Marque/Modèle (GRAS)
  const vehicleParts = [data.vehicle.brand, data.vehicle.model].filter(Boolean);
  const vehicleLabel = vehicleParts.length > 0 ? vehicleParts.join(" ") : "—";
  let vehicleY = y - vehicleCardHeight;
  const vehicleLines = wrapText(
    cleanTextForWinAnsi(vehicleLabel),
    cardWidth - 2 * cardPadding,
    FONT_SIZE_BODY,
    fontBold
  );
  for (const line of vehicleLines.slice(0, 2)) {
    page.drawText(line, {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_BODY,
      font: fontBold,
      color: theme.text,
    });
    vehicleY -= LINE_HEIGHT_BODY;
    vehicleCardHeight += LINE_HEIGHT_BODY;
  }
  vehicleCardHeight += SPACE_XS;
  
  // Immatriculation (TRÈS VISIBLE)
  if (data.vehicle.registration) {
    vehicleY -= SPACE_XS;
    page.drawText("Immatriculation", {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_SMALL,
      font,
      color: theme.text_secondary,
    });
    vehicleY -= LINE_HEIGHT_COMPACT;
    page.drawText(cleanTextForWinAnsi(data.vehicle.registration), {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_BODY,
      font: fontBold,
      color: theme.text,
    });
    vehicleCardHeight += LINE_HEIGHT_COMPACT * 2 + SPACE_XS;
  }
  
  // VIN si disponible
  if (data.vehicle.vin) {
    vehicleY -= SPACE_XS;
    page.drawText("VIN", {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_SMALL,
      font,
      color: theme.text_secondary,
    });
    vehicleY -= LINE_HEIGHT_COMPACT;
    const vinLines = wrapText(
      cleanTextForWinAnsi(data.vehicle.vin),
      cardWidth - 2 * cardPadding,
      FONT_SIZE_SMALL,
      font
    );
    page.drawText(vinLines[0], {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_SMALL,
      font,
      color: theme.text,
    });
    vehicleCardHeight += LINE_HEIGHT_COMPACT * 2 + SPACE_XS;
  }
  
  // Dessiner card Véhicule
  page.drawRectangle({
    x: vehicleCardX,
    y: y - vehicleCardHeight,
    width: cardWidth,
    height: vehicleCardHeight,
    borderColor: theme.border,
    borderWidth: cardBorderWidth,
    color: theme.surface,
  });
  
  // Retourner y après les deux cards
  const maxCardHeight = Math.max(clientCardHeight, vehicleCardHeight);
  y -= maxCardHeight + SPACE_LG;
  
  return y;
}

// ============================================================================
// HEADER TABLEAU (répété sur chaque page)
// ============================================================================

function drawTableHeader(
  page: PDFPage,
  y: number,
  font: PDFFont,
  fontBold: PDFFont,
  theme: PdfThemeV2
): void {
  const headerHeight = 24;
  const headerY = y;
  
  // Fond header très léger (10-15% couleur primaire)
  page.drawRectangle({
    x: MARGIN_X,
    y: headerY - headerHeight,
    width: TABLE_TOTAL_WIDTH,
    height: headerHeight,
    color: theme.primary_light,
  });
  
  // Bordures verticales
  let colX = MARGIN_X + TABLE_COL_TYPE_W;
  page.drawLine({
    start: { x: colX, y: headerY - headerHeight },
    end: { x: colX, y: headerY },
    thickness: 1,
    color: theme.border,
  });
  
  colX += TABLE_COL_DESC_W + TABLE_SPACING;
  page.drawLine({
    start: { x: colX, y: headerY - headerHeight },
    end: { x: colX, y: headerY },
    thickness: 1,
    color: theme.border,
  });
  
  colX += TABLE_COL_QTY_W + TABLE_SPACING;
  page.drawLine({
    start: { x: colX, y: headerY - headerHeight },
    end: { x: colX, y: headerY },
    thickness: 1,
    color: theme.border,
  });
  
  colX += TABLE_COL_PU_W + TABLE_SPACING;
  page.drawLine({
    start: { x: colX, y: headerY - headerHeight },
    end: { x: colX, y: headerY },
    thickness: 1,
    color: theme.border,
  });
  
  // Bordure horizontale en bas (épaisse)
  page.drawLine({
    start: { x: MARGIN_X, y: headerY - headerHeight },
    end: { x: MARGIN_X + TABLE_TOTAL_WIDTH, y: headerY - headerHeight },
    thickness: 2,
    color: theme.primary,
  });
  
  // Texte header (GRAS) - Utiliser les mêmes positions que les lignes de données
  const headerTextY = headerY - headerHeight / 2 - FONT_SIZE_BODY / 2;
  const headerTypeX = MARGIN_X + SPACE_XS;
  const headerDescX = MARGIN_X + TABLE_COL_TYPE_W + TABLE_SPACING + SPACE_XS;
  const headerQtyX = MARGIN_X + TABLE_COL_TYPE_W + TABLE_SPACING + TABLE_COL_DESC_W + TABLE_SPACING + SPACE_XS;
  const headerPuX = MARGIN_X + TABLE_COL_TYPE_W + TABLE_SPACING + TABLE_COL_DESC_W + TABLE_SPACING + TABLE_COL_QTY_W + TABLE_SPACING;
  const headerTotalX = headerPuX + TABLE_COL_PU_W + TABLE_SPACING;
  
  page.drawText("Type", {
    x: headerTypeX,
    y: headerTextY,
    size: FONT_SIZE_BODY,
    font: fontBold,
    color: theme.text,
  });
  
  page.drawText("Description", {
    x: headerDescX,
    y: headerTextY,
    size: FONT_SIZE_BODY,
    font: fontBold,
    color: theme.text,
  });
  
  page.drawText("Qté", {
    x: headerQtyX,
    y: headerTextY,
    size: FONT_SIZE_BODY,
    font: fontBold,
    color: theme.text,
  });
  
  // PU HT aligné à droite dans sa colonne
  const puHtText = "PU HT";
  const puHtWidth = fontBold.widthOfTextAtSize(puHtText, FONT_SIZE_BODY);
  page.drawText(puHtText, {
    x: headerPuX + TABLE_COL_PU_W - puHtWidth,
    y: headerTextY,
    size: FONT_SIZE_BODY,
    font: fontBold,
    color: theme.text,
  });
  
  // Total HT aligné à droite dans sa colonne
  const totalHtText = "Total HT";
  const totalHtWidth = fontBold.widthOfTextAtSize(totalHtText, FONT_SIZE_BODY);
  page.drawText(totalHtText, {
    x: headerTotalX + TABLE_COL_TOTAL_W - totalHtWidth,
    y: headerTextY,
    size: FONT_SIZE_BODY,
    font: fontBold,
    color: theme.text,
  });
}

// ============================================================================
// TABLEAU LIGNES - Sections PIÈCES / MAIN-D'ŒUVRE / FORFAITS
// ============================================================================

function drawLinesTableV2(
  doc: PDFDocument,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  theme: PdfThemeV2,
  startY: number
): { y: number; lastPage: PDFPage } {
  let state: PdfLayoutState = {
    currentPage: doc.getPage(0),
    y: startY,
    pageNumber: 1,
    totalPages: 1,
  };
  
  // Dessiner header initial
  drawTableHeader(state.currentPage, state.y, font, fontBold, theme);
  state.y -= 35;
  
  // Grouper par type
  const linesByType: Record<string, typeof data.lines> = {
    part: [],
    labor: [],
    forfait: [],
  };
  
  for (const line of data.lines) {
    if (line.type === "part" || line.type === "labor" || line.type === "forfait") {
      linesByType[line.type].push(line);
    } else {
      linesByType.part.push(line);
    }
  }
  
  const typeLabels: Record<string, string> = {
    part: "PIÈCES",
    labor: "MAIN-D'ŒUVRE",
    forfait: "FORFAITS",
  };
  
  let rowIndex = 0;
  
  for (const [type, lines] of Object.entries(linesByType)) {
    if (lines.length === 0) continue;
    
    // Header de section
    if (rowIndex > 0) {
      state.y -= SPACE_MD;
      state.currentPage.drawLine({
        start: { x: MARGIN_X, y: state.y },
        end: { x: PAGE_WIDTH - MARGIN_X, y: state.y },
        thickness: 1,
        color: theme.border,
      });
      state.y -= SPACE_MD;
    }
    
    // Vérifier espace pour header section
    state = ensurePageSpace(doc, state, 30, font, fontBold, theme);
    
    // Titre section avec barre colorée à gauche (4px)
    const sectionLabel = typeLabels[type] || "AUTRES";
    const sectionHeaderHeight = LINE_HEIGHT_H2 + SPACE_XS;
    
    // Barre colorée à gauche (4px) - couleur primaire
    state.currentPage.drawRectangle({
      x: MARGIN_X,
      y: state.y - sectionHeaderHeight,
      width: 4,
      height: sectionHeaderHeight,
      color: theme.primary,
    });
    
    // Label section (GRAS)
    state.currentPage.drawText(cleanTextForWinAnsi(sectionLabel), {
      x: MARGIN_X + SPACE_MD,
      y: state.y - sectionHeaderHeight / 2 - FONT_SIZE_H2 / 2,
      size: FONT_SIZE_H2,
      font: fontBold,
      color: theme.text,
    });
    
    // Sous-total section (aligné à droite, GRAS)
    const sectionSubtotal = lines.reduce((sum, line) => sum + line.totalHt, 0);
    const subtotalText = formatMoney(sectionSubtotal);
    state.currentPage.drawText(cleanTextForWinAnsi(subtotalText), {
      x: MARGIN_X + TABLE_COL_TYPE_W + TABLE_COL_DESC_W + TABLE_COL_QTY_W + TABLE_COL_PU_W + TABLE_SPACING * 4 + TABLE_COL_TOTAL_W - fontBold.widthOfTextAtSize(subtotalText, FONT_SIZE_H2),
      y: state.y - sectionHeaderHeight / 2 - FONT_SIZE_H2 / 2,
      size: FONT_SIZE_H2,
      font: fontBold,
      color: theme.text,
    });
    
    state.y -= sectionHeaderHeight + SPACE_XS;
    
    // Lignes de cette section
    for (const line of lines) {
      const descText = cleanTextForWinAnsi(line.description || "");
      const typeText = cleanTextForWinAnsi(line.typeLabel);
      
      // Calculer hauteur de ligne nécessaire
      const descMaxWidth = TABLE_COL_DESC_W - SPACE_XS * 2;
      const descLines = wrapText(descText, descMaxWidth, FONT_SIZE_BODY, font);
      const numDescLines = Math.min(3, descLines.length); // Max 3 lignes
      const lineSpacing = FONT_SIZE_BODY + 2;
      const rowHeight = Math.max(LINE_HEIGHT_BODY + 6, numDescLines * lineSpacing + SPACE_XS * 2);
      
      // Vérifier espace pour cette ligne
      state = ensurePageSpace(doc, state, rowHeight + SPACE_XS, font, fontBold, theme);
      
      const rowStartY = state.y;
      
      // Zebra (alternance gris très clair)
      if (rowIndex % 2 === 1) {
        state.currentPage.drawRectangle({
          x: MARGIN_X,
          y: rowStartY - rowHeight,
          width: TABLE_TOTAL_WIDTH,
          height: rowHeight,
          color: theme.zebra,
        });
      }
      
      // Bordures verticales (fines)
      let colX = MARGIN_X + TABLE_COL_TYPE_W;
      state.currentPage.drawLine({
        start: { x: colX, y: rowStartY - rowHeight },
        end: { x: colX, y: rowStartY },
        thickness: 0.5,
        color: theme.border_light,
      });
      
      colX += TABLE_COL_DESC_W + TABLE_SPACING;
      state.currentPage.drawLine({
        start: { x: colX, y: rowStartY - rowHeight },
        end: { x: colX, y: rowStartY },
        thickness: 0.5,
        color: theme.border_light,
      });
      
      colX += TABLE_COL_QTY_W + TABLE_SPACING;
      state.currentPage.drawLine({
        start: { x: colX, y: rowStartY - rowHeight },
        end: { x: colX, y: rowStartY },
        thickness: 0.5,
        color: theme.border_light,
      });
      
      colX += TABLE_COL_PU_W + TABLE_SPACING;
      state.currentPage.drawLine({
        start: { x: colX, y: rowStartY - rowHeight },
        end: { x: colX, y: rowStartY },
        thickness: 0.5,
        color: theme.border_light,
      });
      
      // Bordure horizontale en bas
      state.currentPage.drawLine({
        start: { x: MARGIN_X, y: rowStartY - rowHeight },
        end: { x: MARGIN_X + TABLE_TOTAL_WIDTH, y: rowStartY - rowHeight },
        thickness: 0.5,
        color: theme.border_light,
      });
      
      // Calcul des positions X de chaque colonne (une seule fois par ligne)
      const colTypeX = MARGIN_X + SPACE_XS;
      const colDescX = MARGIN_X + TABLE_COL_TYPE_W + TABLE_SPACING + SPACE_XS;
      const colDescXEnd = colDescX + TABLE_COL_DESC_W - SPACE_XS; // Fin de la colonne description
      const colQtyX = MARGIN_X + TABLE_COL_TYPE_W + TABLE_SPACING + TABLE_COL_DESC_W + TABLE_SPACING + SPACE_XS;
      const colPuXStart = MARGIN_X + TABLE_COL_TYPE_W + TABLE_SPACING + TABLE_COL_DESC_W + TABLE_SPACING + TABLE_COL_QTY_W + TABLE_SPACING;
      const colPuXEnd = colPuXStart + TABLE_COL_PU_W;
      const colTotalXStart = colPuXEnd + TABLE_SPACING;
      const colTotalXEnd = colTotalXStart + TABLE_COL_TOTAL_W;
      
      // Type (tronquer si trop long pour éviter le débordement)
      const typeY = rowStartY - rowHeight / 2 - FONT_SIZE_SMALL / 2;
      const typeMaxWidth = TABLE_COL_TYPE_W - SPACE_XS * 2;
      let typeTextToDraw = typeText;
      let typeTextWidth = font.widthOfTextAtSize(typeTextToDraw, FONT_SIZE_SMALL);
      
      if (typeTextWidth > typeMaxWidth) {
        // Tronquer avec "..." si nécessaire
        while (font.widthOfTextAtSize(typeTextToDraw + "...", FONT_SIZE_SMALL) > typeMaxWidth && typeTextToDraw.length > 0) {
          typeTextToDraw = typeTextToDraw.slice(0, -1);
        }
        typeTextToDraw = typeTextToDraw + "...";
      }
      
      state.currentPage.drawText(typeTextToDraw, {
        x: colTypeX,
        y: typeY,
        size: FONT_SIZE_SMALL,
        font,
        color: theme.text_secondary,
      });
      
      // Description (multi-ligne, retour à la ligne propre)
      // Note: descMaxWidth est déjà défini plus haut dans la boucle (ligne 1025)
      let descY = rowStartY - SPACE_XS - FONT_SIZE_BODY;
      for (let i = 0; i < numDescLines; i++) {
        const line = descLines[i];
        const lineWidth = font.widthOfTextAtSize(line, FONT_SIZE_BODY);
        if (lineWidth > descMaxWidth) {
          let truncated = line;
          while (
            font.widthOfTextAtSize(truncated + "...", FONT_SIZE_BODY) > descMaxWidth &&
            truncated.length > 0
          ) {
            truncated = truncated.slice(0, -1);
          }
          state.currentPage.drawText(truncated + "...", {
            x: colDescX,
            y: descY,
            size: FONT_SIZE_BODY,
            font,
            color: theme.text,
          });
        } else {
          state.currentPage.drawText(line, {
            x: colDescX,
            y: descY,
            size: FONT_SIZE_BODY,
            font,
            color: theme.text,
          });
        }
        descY -= lineSpacing;
      }
      
      // Quantité
      const qtyY = rowStartY - rowHeight / 2 - FONT_SIZE_BODY / 2;
      const qtyText =
        line.type === "labor" ? formatHours(line.quantity) : String(line.quantity);
      state.currentPage.drawText(cleanTextForWinAnsi(qtyText), {
        x: colQtyX,
        y: qtyY,
        size: FONT_SIZE_BODY,
        font,
        color: theme.text,
      });
      
      // Prix unitaire (aligné à droite dans sa colonne, GRAS pour visibilité)
      let puStr = formatMoney(line.unitPrice);
      let puStrClean = cleanTextForWinAnsi(puStr);
      let puStrWidth = fontBold.widthOfTextAtSize(puStrClean, FONT_SIZE_BODY);
      const puMaxWidth = TABLE_COL_PU_W - SPACE_XS * 2; // Largeur disponible moins les marges
      
      // Tronquer si le texte dépasse la colonne
      if (puStrWidth > puMaxWidth) {
        // Réduire progressivement jusqu'à ce que ça rentre
        while (puStrWidth > puMaxWidth && puStrClean.length > 0) {
          puStrClean = puStrClean.slice(0, -1);
          puStrWidth = fontBold.widthOfTextAtSize(puStrClean, FONT_SIZE_BODY);
        }
      }
      
      // Aligner à droite : début colonne + largeur colonne - largeur texte
      const puX = Math.max(colPuXStart + SPACE_XS, colPuXEnd - puStrWidth - SPACE_XS);
      state.currentPage.drawText(puStrClean, {
        x: puX,
        y: qtyY,
        size: FONT_SIZE_BODY,
        font: fontBold,
        color: theme.text,
      });
      
      // Total HT (aligné à droite dans sa colonne, GRAS pour visibilité)
      let totalStr = formatMoney(line.totalHt);
      let totalStrClean = cleanTextForWinAnsi(totalStr);
      let totalStrWidth = fontBold.widthOfTextAtSize(totalStrClean, FONT_SIZE_BODY);
      const totalMaxWidth = TABLE_COL_TOTAL_W - SPACE_XS * 2; // Largeur disponible moins les marges
      
      // Tronquer si le texte dépasse la colonne
      if (totalStrWidth > totalMaxWidth) {
        // Réduire progressivement jusqu'à ce que ça rentre
        while (totalStrWidth > totalMaxWidth && totalStrClean.length > 0) {
          totalStrClean = totalStrClean.slice(0, -1);
          totalStrWidth = fontBold.widthOfTextAtSize(totalStrClean, FONT_SIZE_BODY);
        }
      }
      
      // Aligner à droite : début colonne + largeur colonne - largeur texte
      const totalX = Math.max(colTotalXStart + SPACE_XS, colTotalXEnd - totalStrWidth - SPACE_XS);
      state.currentPage.drawText(totalStrClean, {
        x: totalX,
        y: qtyY,
        size: FONT_SIZE_BODY,
        font: fontBold,
        color: theme.text,
      });
      
      state.y -= rowHeight + SPACE_XS;
      rowIndex++;
    }
  }
  
  state.y -= SPACE_MD;
  return { y: state.y, lastPage: state.currentPage };
}

// ============================================================================
// BLOC TOTAUX - Zone Forte (jamais coupé entre pages)
// ============================================================================

function drawTotalsBlockV2(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  theme: PdfThemeV2,
  startY: number
): number {
  // Calculer hauteur nécessaire AVANT de dessiner
  let totalsHeight = TOTALS_BOX_PADDING * 2;
  totalsHeight += LINE_HEIGHT_BODY + SPACE_XS; // Total HT
  totalsHeight += LINE_HEIGHT_BODY + SPACE_XS; // TVA
  totalsHeight += SPACE_MD; // Séparation
  totalsHeight += (FONT_SIZE_H1 - 2) + SPACE_XS; // Ligne "NET À PAYER"
  totalsHeight += LINE_HEIGHT_BODY + SPACE_XS; // Ligne montant TTC (évite chevauchement)
  totalsHeight += SPACE_MD; // Espace après TTC
  
  if (data.documentType === "facture" && data.paymentStatus) {
    totalsHeight += LINE_HEIGHT_BODY + SPACE_XS;
  }
  
  if (data.garage?.iban) {
    totalsHeight += LINE_HEIGHT_COMPACT * 2 + SPACE_XS;
  }
  
  // Vérifier qu'on a assez d'espace (sinon on aurait dû créer une nouvelle page avant)
  const minY = MARGIN_Y + 100;
  let y = startY;
  
  if (y - totalsHeight < minY) {
    // Pas assez d'espace, on remonte un peu
    y = minY + totalsHeight;
  }
  
  const totalsBoxX = TOTALS_BOX_X;
  const totalsPadding = TOTALS_BOX_PADDING;
  
  // Card avec bordure et fond léger
  page.drawRectangle({
    x: totalsBoxX,
    y: y - totalsHeight,
    width: TOTALS_BOX_WIDTH,
    height: totalsHeight,
    borderColor: theme.border,
    borderWidth: 2,
  });
  
  // Fond léger
  page.drawRectangle({
    x: totalsBoxX + 1,
    y: y - totalsHeight + 1,
    width: TOTALS_BOX_WIDTH - 2,
    height: totalsHeight - 2,
    color: theme.surface,
  });
  
  // Ligne de séparation épaisse en haut (couleur primaire)
  page.drawLine({
    start: { x: totalsBoxX, y },
    end: { x: totalsBoxX + TOTALS_BOX_WIDTH, y },
    thickness: 2,
    color: theme.primary,
  });
  
  let totalsY = y - totalsPadding - 2;
  
  // Total HT (GRAS)
  page.drawText("Total HT", {
    x: totalsBoxX + totalsPadding,
    y: totalsY,
    size: FONT_SIZE_BODY + 1,
    font: fontBold,
    color: theme.text,
  });
  const totalHtStr = formatMoney(data.totalHt);
  page.drawText(cleanTextForWinAnsi(totalHtStr), {
    x: totalsBoxX + TOTALS_BOX_WIDTH - totalsPadding - fontBold.widthOfTextAtSize(totalHtStr, FONT_SIZE_BODY + 1),
    y: totalsY,
    size: FONT_SIZE_BODY + 1,
    font: fontBold,
    color: theme.text,
  });
  totalsY -= LINE_HEIGHT_BODY + SPACE_XS;
  
  // TVA (GRAS)
  const vatLabel = `TVA ${data.vatRate ?? 20} %`;
  page.drawText(cleanTextForWinAnsi(vatLabel), {
    x: totalsBoxX + totalsPadding,
    y: totalsY,
    size: FONT_SIZE_BODY + 1,
    font: fontBold,
    color: theme.text,
  });
  const totalTvaStr = formatMoney(data.totalTva);
  page.drawText(cleanTextForWinAnsi(totalTvaStr), {
    x: totalsBoxX + TOTALS_BOX_WIDTH - totalsPadding - fontBold.widthOfTextAtSize(totalTvaStr, FONT_SIZE_BODY + 1),
    y: totalsY,
    size: FONT_SIZE_BODY + 1,
    font: fontBold,
    color: theme.text,
  });
  totalsY -= LINE_HEIGHT_BODY + SPACE_MD;
  
  // Séparation épaisse avant TOTAL TTC
  page.drawLine({
    start: { x: totalsBoxX + totalsPadding, y: totalsY },
    end: { x: totalsBoxX + TOTALS_BOX_WIDTH - totalsPadding, y: totalsY },
    thickness: 2,
    color: theme.primary,
  });
  totalsY -= SPACE_MD;
  
  // NET À PAYER (label seul, une ligne) - TRÈS GRAND et GRAS
  page.drawText("NET À PAYER", {
    x: totalsBoxX + totalsPadding,
    y: totalsY,
    size: FONT_SIZE_H2,
    font: fontBold,
    color: theme.text,
  });
  totalsY -= LINE_HEIGHT_BODY + SPACE_XS;
  
  // Montant TTC (ligne suivante, aligné à droite) - évite chevauchement avec le label
  const totalTtcStr = formatMoney(data.totalTtc);
  page.drawText(cleanTextForWinAnsi(totalTtcStr), {
    x: totalsBoxX + TOTALS_BOX_WIDTH - totalsPadding - fontBold.widthOfTextAtSize(totalTtcStr, FONT_SIZE_H2),
    y: totalsY,
    size: FONT_SIZE_H2,
    font: fontBold,
    color: theme.primary,
  });
  totalsY -= FONT_SIZE_H2 + SPACE_MD;
  
  // Statut de paiement (pour factures)
  if (data.documentType === "facture" && data.paymentStatus) {
    let statusText = "";
    if (data.paymentStatus === "paid") {
      statusText = data.paymentDate
        ? `Payé le ${formatDate(data.paymentDate)}`
        : "Payé";
      if (data.paymentMethod) {
        statusText += ` (${data.paymentMethod})`;
      }
    } else if (data.paymentStatus === "partial") {
      statusText = "Paiement partiel";
    } else {
      statusText = data.dueDate
        ? `À payer avant le ${formatDate(data.dueDate)}`
        : "À payer";
    }
    
    page.drawText(cleanTextForWinAnsi(statusText), {
      x: totalsBoxX + totalsPadding,
      y: totalsY,
      size: FONT_SIZE_BODY,
      font: fontBold,
      color: theme.text,
    });
    totalsY -= LINE_HEIGHT_BODY + SPACE_XS;
  }
  
  // IBAN/BIC si disponible
  if (data.garage?.iban) {
    totalsY -= SPACE_XS;
    page.drawText("Paiement", {
      x: totalsBoxX + totalsPadding,
      y: totalsY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: theme.text_secondary,
    });
    totalsY -= LINE_HEIGHT_COMPACT;
    
    const ibanText = `IBAN: ${data.garage.iban}`;
    page.drawText(cleanTextForWinAnsi(ibanText), {
      x: totalsBoxX + totalsPadding,
      y: totalsY,
      size: FONT_SIZE_SMALL,
      font,
      color: theme.text_secondary,
    });
    totalsY -= LINE_HEIGHT_COMPACT;
    
    if (data.garage.bic) {
      const bicText = `BIC: ${data.garage.bic}`;
      page.drawText(cleanTextForWinAnsi(bicText), {
        x: totalsBoxX + totalsPadding,
        y: totalsY,
        size: FONT_SIZE_SMALL,
        font,
        color: theme.text_secondary,
      });
    }
  }
  
  return totalsY - totalsPadding;
}

// ============================================================================
// FOOTER - Mentions Légales + Pagination
// ============================================================================

function drawFooterV2(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  theme: PdfThemeV2,
  pageNumber: number,
  totalPages: number
): void {
  const footerY = MARGIN_Y;
  
  // Ligne de séparation fine
  page.drawLine({
    start: { x: MARGIN_X, y: footerY + SPACE_MD },
    end: { x: PAGE_WIDTH - MARGIN_X, y: footerY + SPACE_MD },
    thickness: 0.5,
    color: theme.border_light,
  });
  
  let y = footerY;
  
  // Gauche : Date de génération
  const generatedDate = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  page.drawText(cleanTextForWinAnsi(`Document généré le ${generatedDate}`), {
    x: MARGIN_X,
    y,
    size: FONT_SIZE_TINY,
    font,
    color: theme.text_muted,
  });
  
  // Centre : Brand name
  const brandName = data.garage?.name || "GarageOS";
  const brandWidth = font.widthOfTextAtSize(brandName, FONT_SIZE_TINY);
  page.drawText(cleanTextForWinAnsi(brandName), {
    x: PAGE_WIDTH / 2 - brandWidth / 2,
    y,
    size: FONT_SIZE_TINY,
    font,
    color: theme.text_muted,
  });
  
  // Droite : Page X / Y
  const pageText = `Page ${pageNumber} / ${totalPages}`;
  page.drawText(cleanTextForWinAnsi(pageText), {
    x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(pageText, FONT_SIZE_TINY),
    y,
    size: FONT_SIZE_TINY,
    font,
    color: theme.text_muted,
  });
  
  y -= LINE_HEIGHT_COMPACT + SPACE_XS;
  
  // Mentions légales (si disponibles)
  const legalLines: string[] = [];
  
  if (data.garage?.legal_mentions?.trim()) {
    legalLines.push(data.garage.legal_mentions.trim());
  }
  
  if (data.garage?.payment_terms?.trim()) {
    legalLines.push(`Conditions de paiement : ${data.garage.payment_terms.trim()}`);
  }
  
  if (data.garage?.late_payment_penalties?.trim()) {
    legalLines.push(`Pénalités de retard : ${data.garage.late_payment_penalties.trim()}`);
  }
  
  if (data.documentType === "devis" && !data.pdfFooter) {
    legalLines.push(
      `Ce devis est valable ${data.quoteValidDays ?? 30} jours à compter de sa date d'émission, sauf indication contraire.`
    );
  }
  
  // Dessiner mentions (max 2 lignes)
  for (const line of legalLines.slice(0, 2)) {
    if (y < MARGIN_Y - 20) break;
    const cleanedLine = cleanTextForWinAnsi(line);
    const wrappedLines = wrapText(cleanedLine, CONTENT_WIDTH, FONT_SIZE_TINY, font);
    for (const wrappedLine of wrappedLines.slice(0, 1)) {
      if (y < MARGIN_Y - 20) break;
      page.drawText(wrappedLine.slice(0, 120), {
        x: MARGIN_X,
        y,
        size: FONT_SIZE_TINY,
        font,
        color: theme.text_muted,
      });
      y -= LINE_HEIGHT_COMPACT;
    }
  }
  
  // "Généré via GarageOS" très discret
  y = MARGIN_Y - SPACE_XS;
  page.drawText(cleanTextForWinAnsi("Généré via GarageOS"), {
    x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize("Généré via GarageOS", FONT_SIZE_TINY - 1),
    y,
    size: FONT_SIZE_TINY - 1,
    font,
    color: theme.text_muted,
  });
}

// ============================================================================
// MOTEUR PRINCIPAL V2
// ============================================================================

export async function renderInvoicePdfV2(data: PdfDevisPayload): Promise<Uint8Array> {
  try {
    // Validations
    if (!data || !data.lines || data.lines.length === 0) {
      throw new Error("Le document doit contenir au moins une ligne.");
    }
    if (
      typeof data.totalHt !== "number" ||
      typeof data.totalTva !== "number" ||
      typeof data.totalTtc !== "number"
    ) {
      throw new Error("Les totaux doivent être des nombres valides.");
    }
    
    // Générer thème caméléon
    const garageData: PdfDevisGarage | null = data.garage || null;
    const theme = generatePdfThemeV2({
      theme_primary: garageData?.theme_primary ?? null,
      theme_accent: garageData?.theme_accent ?? null,
    });
    
    // Créer document et charger polices (Inter premium ou Helvetica en secours)
    const doc = await PDFDocument.create();
    const { font, fontBold } = await loadPdfFonts(doc);
    
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - MARGIN_Y;
    
    // Header
    y = await drawHeaderV2(doc, page, data, font, fontBold, theme);
    
    // Titre document
    y = drawDocumentTitle(page, data, font, fontBold, theme, y);
    
    // Bloc Client/Véhicule
    y = drawClientVehicleBlockV2(page, data, font, fontBold, theme, y);
    
    // Tableau lignes (avec pagination robuste)
    const { y: tableY, lastPage } = drawLinesTableV2(doc, data, font, fontBold, theme, y);
    y = tableY;
    
    // Bloc totaux (vérification espace avant - jamais coupé entre pages)
    const totalsHeight = 180; // Estimation généreuse
    if (y - totalsHeight < MARGIN_Y + 100) {
      // Pas assez d'espace, créer nouvelle page
      const newPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN_Y - SPACE_LG;
    } else {
      y = tableY;
    }
    
    y = drawTotalsBlockV2(lastPage, data, font, fontBold, theme, y);
    
    // Footer sur toutes les pages
    const totalPages = doc.getPageCount();
    for (let i = 0; i < totalPages; i++) {
      const currentPage = doc.getPage(i);
      drawFooterV2(currentPage, data, font, theme, i + 1, totalPages);
    }
    
    return doc.save();
  } catch (error) {
    console.error("Erreur dans renderInvoicePdfV2:", error);
    throw error instanceof Error
      ? error
      : new Error(`Erreur lors de la génération du PDF: ${String(error)}`);
  }
}
