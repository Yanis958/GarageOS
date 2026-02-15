/**
 * Template PDF Premium "Corporate Enterprise"
 * Design sobre, minimal, spacing généreux, alignements stricts
 * S'adapte automatiquement au branding de chaque garage
 */

import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont, PDFImage } from "pdf-lib";
import type { PdfDevisPayload } from "./types";
import { getGarageTheme, type ThemeTokens } from "@/lib/theme/tokens";

// ---------- Dimensions A4 Premium
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 36; // Marges généreuses mais pas excessives (28-36px)
const MARGIN_Y = 36;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;

// ---------- Typographie (même font que le projet actuel)
const FONT_SIZE_H1 = 24; // Titre principal
const FONT_SIZE_H2 = 12; // Sous-titres
const FONT_SIZE_NORMAL = 10;
const FONT_SIZE_SMALL = 9;
const FONT_SIZE_TINY = 8;
const LINE_HEIGHT_NORMAL = 14;
const LINE_HEIGHT_COMPACT = 12;

// ---------- Espacements premium
const SPACING_XS = 4;
const SPACING_SM = 8;
const SPACING_MD = 12;
const SPACING_LG = 16;
const SPACING_XL = 24;

// ---------- Logo/Monogramme
const LOGO_MAX_WIDTH = 100;
const LOGO_MAX_HEIGHT = 40;
const MONOGRAM_SIZE = 40;

// ---------- Tokens de thème étendus pour PDF premium
export type PremiumThemeTokens = ThemeTokens & {
  accent_soft: ReturnType<typeof withAlpha>; // Accent avec 10-15% opacité
  border_light: ReturnType<typeof withAlpha>; // Bordure très légère
};

/**
 * Crée une couleur avec opacité (alpha) pour PDF
 * Note: pdf-lib ne supporte pas directement l'alpha, on simule avec un mélange avec blanc
 */
function withAlpha(color: ReturnType<typeof rgb>, alpha: number): ReturnType<typeof rgb> {
  // Valider que la couleur d'entrée est valide (pas NaN)
  if (
    isNaN(color.red) ||
    isNaN(color.green) ||
    isNaN(color.blue) ||
    !isFinite(color.red) ||
    !isFinite(color.green) ||
    !isFinite(color.blue)
  ) {
    console.warn("withAlpha: couleur invalide (NaN ou infini), utilisation de la couleur par défaut");
    // Retourner une couleur par défaut (gris très clair)
    return rgb(0.97, 0.97, 0.97);
  }
  
  // Valider que alpha est valide
  if (isNaN(alpha) || !isFinite(alpha) || alpha < 0 || alpha > 1) {
    console.warn(`withAlpha: alpha invalide (${alpha}), utilisation de 0.1 par défaut`);
    alpha = 0.1;
  }
  
  // Mélanger avec blanc pour simuler l'opacité
  const white = rgb(1, 1, 1);
  const r = color.red * alpha + white.red * (1 - alpha);
  const g = color.green * alpha + white.green * (1 - alpha);
  const b = color.blue * alpha + white.blue * (1 - alpha);
  
  // Vérifier que les résultats ne sont pas NaN
  if (isNaN(r) || isNaN(g) || isNaN(b) || !isFinite(r) || !isFinite(g) || !isFinite(b)) {
    console.warn("withAlpha: résultat NaN, utilisation de la couleur par défaut");
    return rgb(0.97, 0.97, 0.97);
  }
  
  return rgb(r, g, b);
}

/**
 * Valide qu'une couleur RGB est valide (pas NaN, finie, dans la plage 0-1)
 */
function isValidRgb(color: ReturnType<typeof rgb>): boolean {
  return (
    !isNaN(color.red) &&
    !isNaN(color.green) &&
    !isNaN(color.blue) &&
    isFinite(color.red) &&
    isFinite(color.green) &&
    isFinite(color.blue) &&
    color.red >= 0 &&
    color.red <= 1 &&
    color.green >= 0 &&
    color.green <= 1 &&
    color.blue >= 0 &&
    color.blue <= 1
  );
}

/**
 * Génère les tokens premium étendus (design sobre, noir/gris uniquement)
 */
function getPremiumThemeTokens(baseTokens: ThemeTokens): PremiumThemeTokens {
  // Design sobre : utiliser uniquement noir/gris, pas de couleur
  const primary = rgb(0.1, 0.1, 0.1); // Noir pour texte important
  const border = rgb(0.75, 0.75, 0.75); // Gris moyen pour bordures
  const accent_soft = rgb(0.96, 0.96, 0.96); // Gris très clair pour fonds
  const border_light = rgb(0.9, 0.9, 0.9); // Gris clair pour bordures légères
  
  return {
    ...baseTokens,
    primary, // Noir pour hiérarchie
    primary_50: accent_soft, // Gris très clair
    primary_100: rgb(0.92, 0.92, 0.92), // Gris clair
    primary_600: rgb(0.3, 0.3, 0.3), // Gris foncé
    primary_700: rgb(0.15, 0.15, 0.15), // Presque noir
    primary_900: rgb(0.05, 0.05, 0.05), // Noir profond
    accent: rgb(0.2, 0.2, 0.2), // Gris foncé
    accent_50: accent_soft,
    accent_600: rgb(0.3, 0.3, 0.3),
    border, // Gris moyen
    accent_soft, // Gris très clair pour fonds
    border_light, // Gris clair pour bordures
  };
}

/**
 * Nettoie une chaîne pour l'encodage WinAnsi
 */
function cleanTextForWinAnsi(text: string | null | undefined): string {
  if (!text) return text || "";
  let cleaned = String(text);
  
  cleaned = cleaned.replace(/€/g, "EUR");
  cleaned = cleaned
    .replace(/\u202F/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/\u2009/g, " ")
    .replace(/[\u2000-\u200B\u2028-\u202F]/g, " ");
  
  cleaned = cleaned
    .replace(/\u0153/g, "oe")
    .replace(/\u0152/g, "OE")
    .replace(/\u00E6/g, "ae")
    .replace(/\u00C6/g, "AE")
    .replace(/\u00E0/g, "a")
    .replace(/\u00E1/g, "a")
    .replace(/\u00E2/g, "a")
    .replace(/\u00E4/g, "a")
    .replace(/\u00E8/g, "e")
    .replace(/\u00E9/g, "e")
    .replace(/\u00EA/g, "e")
    .replace(/\u00EB/g, "e")
    .replace(/\u00EC/g, "i")
    .replace(/\u00ED/g, "i")
    .replace(/\u00EE/g, "i")
    .replace(/\u00EF/g, "i")
    .replace(/\u00F2/g, "o")
    .replace(/\u00F3/g, "o")
    .replace(/\u00F4/g, "o")
    .replace(/\u00F6/g, "o")
    .replace(/\u00F9/g, "u")
    .replace(/\u00FA/g, "u")
    .replace(/\u00FB/g, "u")
    .replace(/\u00FC/g, "u")
    .replace(/\u00E7/g, "c")
    .replace(/\u00C7/g, "C")
    .replace(/\u00C0/g, "A")
    .replace(/\u00C1/g, "A")
    .replace(/\u00C2/g, "A")
    .replace(/\u00C8/g, "E")
    .replace(/\u00C9/g, "E")
    .replace(/\u00CA/g, "E")
    .replace(/\u00CB/g, "E")
    .replace(/\u00CE/g, "I")
    .replace(/\u00CF/g, "I")
    .replace(/\u00D2/g, "O")
    .replace(/\u00D3/g, "O")
    .replace(/\u00D4/g, "O")
    .replace(/\u00D9/g, "U")
    .replace(/\u00DA/g, "U")
    .replace(/\u00DB/g, "U");
  
  cleaned = cleaned
    .replace(/\u2011/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201C/g, '"')
    .replace(/\u201D/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, "")
    .trim();
  
  return cleaned;
}

/**
 * Formate un montant en euros (format français)
 */
function formatMoney(amount: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return cleanTextForWinAnsi(formatted.replace(/\u202F/g, " ")) + " EUR";
}

/**
 * Formate une date (format français court)
 */
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return cleanTextForWinAnsi(dateStr);
  }
}

/**
 * Formate les heures (ex: 1,2 h / 1h12)
 */
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

/**
 * Wrap du texte sur plusieurs lignes
 */
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

/**
 * Dessine un rectangle arrondi (simulation avec coins arrondis)
 * Note: pdf-lib ne supporte pas les arrondis natifs, on dessine un rectangle simple
 */
function drawRoundedRect(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    borderColor?: ReturnType<typeof rgb>;
    borderWidth?: number;
    fillColor?: ReturnType<typeof rgb>;
  }
): void {
  if (options.fillColor) {
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      color: options.fillColor,
    });
  }
  if (options.borderColor && options.borderWidth) {
    page.drawRectangle({
      x,
      y: y - height,
      width,
      height,
      borderColor: options.borderColor,
      borderWidth: options.borderWidth,
    });
  }
}

/**
 * Intègre le logo ou dessine un monogramme
 */
async function embedLogoOrMonogram(
  doc: PDFDocument,
  page: PDFPage,
  logoUrl: string | null | undefined,
  garageName: string | null,
  x: number,
  y: number,
  tokens: PremiumThemeTokens
): Promise<number> {
  if (logoUrl?.trim()) {
    try {
      const res = await fetch(logoUrl, { mode: "cors" });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        const contentType = res.headers.get("content-type") ?? "";
        let image: PDFImage;
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
          const drawHeight = h * scale;
          page.drawImage(image, {
            x,
            y: y - drawHeight,
            width: drawWidth,
            height: drawHeight,
          });
          return drawHeight;
        }
      }
    } catch (error) {
      console.warn("Erreur lors du chargement du logo:", error);
    }
  }
  
  // Monogramme avec initiales
  const initials = garageName
    ? garageName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "G";
  
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize = 16;
  const textWidth = font.widthOfTextAtSize(initials, fontSize);
  
  // Cercle avec bordure (design sobre)
  page.drawCircle({
    x: x + MONOGRAM_SIZE / 2,
    y: y - MONOGRAM_SIZE / 2,
    size: MONOGRAM_SIZE / 2,
    borderColor: tokens.border,
    borderWidth: 2,
  });
  
  // Initiales au centre (noir)
  page.drawText(cleanTextForWinAnsi(initials), {
    x: x + MONOGRAM_SIZE / 2 - textWidth / 2,
    y: y - MONOGRAM_SIZE / 2 - fontSize / 3,
    size: fontSize,
    font,
    color: tokens.text,
  });
  
  return MONOGRAM_SIZE;
}

/**
 * Dessine le header premium
 */
async function drawPremiumHeader(
  doc: PDFDocument,
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: PremiumThemeTokens,
  startY: number
): Promise<number> {
  let y = startY;
  
  // Pas de bande colorée en haut (design sobre)
  y -= SPACING_MD;
  
  // Logo/Monogramme à gauche
  const logoHeight = await embedLogoOrMonogram(
    doc,
    page,
    data.garage?.logo_url,
    data.garage?.name || null,
    MARGIN_X,
    y,
    tokens
  );
  
  // Bloc garage à droite
  const rightX = PAGE_WIDTH - MARGIN_X;
  const garageName = data.garage?.name?.trim() || "Garage";
  
  // Nom du garage en bold
  page.drawText(cleanTextForWinAnsi(garageName), {
    x: rightX - fontBold.widthOfTextAtSize(garageName, FONT_SIZE_H2),
    y,
    size: FONT_SIZE_H2,
    font: fontBold,
    color: tokens.text,
  });
  y -= LINE_HEIGHT_NORMAL + SPACING_XS;
  
  // Coordonnées garage
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
    const cleanedLine = cleanTextForWinAnsi(line);
    page.drawText(cleanedLine, {
      x: rightX - font.widthOfTextAtSize(cleanedLine, FONT_SIZE_SMALL),
      y,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.textSecondary,
    });
    y -= LINE_HEIGHT_COMPACT;
  }
  
  // Ajuster y selon la hauteur du logo ou du contenu
  const contentHeight = Math.max(logoHeight, garageLines.length * LINE_HEIGHT_COMPACT + LINE_HEIGHT_NORMAL);
  y = startY - contentHeight - SPACING_MD;
  
  // Ligne de séparation fine (gris sobre)
  y -= SPACING_MD;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 1,
    color: tokens.border,
  });
  y -= SPACING_LG;
  
  // Titre du document (grand, bold, noir)
  const docType = data.documentType || "devis";
  const docTitle = docType === "facture" ? "FACTURE" : docType === "avoir" ? "AVOIR" : "DEVIS";
  
  page.drawText(docTitle, {
    x: MARGIN_X,
    y,
    size: FONT_SIZE_H1 + 4, // Plus grand pour visibilité
    font: fontBold,
    color: tokens.text,
  });
  y -= FONT_SIZE_H1 + SPACING_MD;
  
  // Bloc Meta : N° document + dates (aligné proprement)
  const docNumber =
    (docType === "facture" && data.factureNumber) ||
    (docType === "avoir" && data.creditNoteNumber) ||
    data.reference;
  
  // Numéro de document (simple, sobre, bien visible)
  const badgeText = `N° ${docNumber}`;
  const badgeWidth = fontBold.widthOfTextAtSize(badgeText, FONT_SIZE_NORMAL + 1);
  page.drawText(cleanTextForWinAnsi(badgeText), {
    x: MARGIN_X,
    y: y,
    size: FONT_SIZE_NORMAL + 1, // Légèrement plus grand
    font: fontBold,
    color: tokens.text,
  });
  
  // Dates alignées à droite du numéro
  const dateX = MARGIN_X + badgeWidth + SPACING_MD;
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
      color: tokens.textSecondary,
    });
    dateY -= LINE_HEIGHT_COMPACT;
  }
  
  y = Math.min(y, dateY) - SPACING_LG;
  
  return y;
}

/**
 * Dessine le bloc Client/Véhicule en 2 colonnes (cards sobres)
 */
function drawPremiumClientVehicleBlock(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: PremiumThemeTokens,
  startY: number
): number {
  let y = startY;
  
  const cardWidth = (CONTENT_WIDTH - SPACING_MD) / 2;
  const cardPadding = SPACING_MD;
  const cardBorderWidth = 1;
  
  // Card Client (gauche)
  const clientCardX = MARGIN_X;
  let clientCardHeight = cardPadding * 2; // Padding top + bottom
  
  // Header card sobre (pas de couleur)
  const clientHeaderY = y;
  const headerHeight = LINE_HEIGHT_COMPACT + SPACING_XS;
  
  page.drawText("CLIENT", {
    x: clientCardX + cardPadding,
    y: clientHeaderY,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.text,
  });
  clientCardHeight += headerHeight + SPACING_XS;
  
  // Nom client
  const clientName = data.client.name || "—";
  const clientNameLines = wrapText(
    cleanTextForWinAnsi(clientName),
    cardWidth - 2 * cardPadding,
    FONT_SIZE_NORMAL,
    font
  );
  let clientY = y - clientCardHeight;
  for (const line of clientNameLines.slice(0, 2)) {
    page.drawText(line, {
      x: clientCardX + cardPadding,
      y: clientY,
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text,
    });
    clientY -= LINE_HEIGHT_NORMAL;
    clientCardHeight += LINE_HEIGHT_NORMAL;
  }
  clientCardHeight += SPACING_XS;
  
  // Adresse client
  const addressParts = [
    data.client.address,
    data.client.address_line2,
    data.client.postal_code && data.client.city
      ? `${data.client.postal_code} ${data.client.city}`
      : data.client.postal_code || data.client.city,
  ].filter(Boolean);
  
  if (addressParts.length > 0) {
    const addressText = addressParts.join(", ");
    const addressLines = wrapText(
      cleanTextForWinAnsi(addressText),
      cardWidth - 2 * cardPadding,
      FONT_SIZE_SMALL,
      font
    );
    clientY -= SPACING_XS;
    for (const line of addressLines.slice(0, 2)) {
      page.drawText(line, {
        x: clientCardX + cardPadding,
        y: clientY,
        size: FONT_SIZE_SMALL,
        font,
        color: tokens.textSecondary,
      });
      clientY -= LINE_HEIGHT_COMPACT;
      clientCardHeight += LINE_HEIGHT_COMPACT;
    }
    clientCardHeight += SPACING_XS;
  }
  
  // Email/Téléphone
  if (data.client.email || data.client.phone) {
    clientY -= SPACING_XS;
    const contactInfo = [data.client.email, data.client.phone]
      .filter(Boolean)
      .join(" / ");
    page.drawText(cleanTextForWinAnsi(contactInfo), {
      x: clientCardX + cardPadding,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.textSecondary,
    });
    clientCardHeight += LINE_HEIGHT_COMPACT + SPACING_XS;
  }
  
  clientCardHeight += cardPadding;
  
  // Dessiner la card Client
  drawRoundedRect(page, clientCardX, y, cardWidth, clientCardHeight, {
    borderColor: tokens.border,
    borderWidth: cardBorderWidth,
    fillColor: tokens.surface,
  });
  
  // Card Véhicule (droite)
  const vehicleCardX = MARGIN_X + cardWidth + SPACING_MD;
  let vehicleCardHeight = cardPadding * 2; // Padding top + bottom
  
  // Header card sobre (pas de couleur)
  const vehicleHeaderY = y;
  const vehicleHeaderHeight = LINE_HEIGHT_COMPACT + SPACING_XS;
  
  page.drawText("VÉHICULE", {
    x: vehicleCardX + cardPadding,
    y: vehicleHeaderY,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.text,
  });
  vehicleCardHeight += vehicleHeaderHeight + SPACING_XS;
  
  // Marque/Modèle
  const vehicleParts = [data.vehicle.brand, data.vehicle.model].filter(Boolean);
  const vehicleLabel = vehicleParts.length > 0 ? vehicleParts.join(" ") : "—";
  let vehicleY = y - vehicleCardHeight;
  const vehicleLines = wrapText(
    cleanTextForWinAnsi(vehicleLabel),
    cardWidth - 2 * cardPadding,
    FONT_SIZE_NORMAL,
    font
  );
  for (const line of vehicleLines.slice(0, 2)) {
    page.drawText(line, {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text,
    });
    vehicleY -= LINE_HEIGHT_NORMAL;
    vehicleCardHeight += LINE_HEIGHT_NORMAL;
  }
  vehicleCardHeight += SPACING_XS;
  
  // Immatriculation
  if (data.vehicle.registration) {
    vehicleY -= SPACING_XS;
    page.drawText("Immatriculation", {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.textSecondary,
    });
    vehicleY -= LINE_HEIGHT_COMPACT;
    page.drawText(cleanTextForWinAnsi(data.vehicle.registration), {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: tokens.text,
    });
    vehicleCardHeight += LINE_HEIGHT_COMPACT * 2 + SPACING_XS;
  }
  
  // VIN
  if (data.vehicle.vin) {
    vehicleY -= SPACING_XS;
    page.drawText("VIN", {
      x: vehicleCardX + cardPadding,
      y: vehicleY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.textSecondary,
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
      color: tokens.text,
    });
    vehicleCardHeight += LINE_HEIGHT_COMPACT * 2 + SPACING_XS;
  }
  
  vehicleCardHeight += cardPadding;
  
  // Dessiner la card Véhicule
  drawRoundedRect(page, vehicleCardX, y, cardWidth, vehicleCardHeight, {
    borderColor: tokens.border,
    borderWidth: cardBorderWidth,
    fillColor: tokens.surface,
  });
  
  // Retourner y après les deux cards
  const maxCardHeight = Math.max(clientCardHeight, vehicleCardHeight);
  y -= maxCardHeight + SPACING_LG;
  
  return y;
}

/**
 * Dessine la table premium avec header répété, zebra très léger, row groups
 */
function drawPremiumLinesTable(
  doc: PDFDocument,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: PremiumThemeTokens,
  startY: number
): { y: number; lastPage: PDFPage } {
  let y = startY;
  let currentPage = doc.getPage(0);
  
  const tableLeft = MARGIN_X;
  const tableWidth = CONTENT_WIDTH;
  
  // Largeurs de colonnes (optimisées pour visibilité des prix)
  const colTypeW = 60;
  const colDescW = 240;
  const colQtyW = 50;
  const colPuW = 90; // Plus large pour prix unitaires
  const colTotalW = 110; // Plus large pour totaux (visibilité maximale)
  
  const colTypeX = tableLeft;
  const colDescX = colTypeX + colTypeW + SPACING_SM;
  const colQtyX = colDescX + colDescW + SPACING_SM;
  const colPuX = colQtyX + colQtyW + SPACING_SM;
  const colTotalX = colPuX + colPuW + SPACING_SM;
  
  // Fonction pour dessiner le header de table (répété sur chaque page) - design sobre
  const drawTableHeader = (page: PDFPage, headerY: number) => {
    const headerHeight = 22;
    
    // Fond header gris très clair (sobre)
    page.drawRectangle({
      x: tableLeft,
      y: headerY - headerHeight,
      width: tableWidth,
      height: headerHeight,
      color: rgb(0.95, 0.95, 0.95), // Gris très clair
    });
    
    // Bordures verticales pour séparer les colonnes (visibles)
    const borderY = headerY - headerHeight;
    const borderColor = tokens.border;
    page.drawLine({
      start: { x: colDescX - SPACING_XS / 2, y: borderY },
      end: { x: colDescX - SPACING_XS / 2, y: borderY + headerHeight },
      thickness: 0.8,
      color: borderColor,
    });
    page.drawLine({
      start: { x: colQtyX - SPACING_XS / 2, y: borderY },
      end: { x: colQtyX - SPACING_XS / 2, y: borderY + headerHeight },
      thickness: 0.8,
      color: borderColor,
    });
    page.drawLine({
      start: { x: colPuX - SPACING_XS / 2, y: borderY },
      end: { x: colPuX - SPACING_XS / 2, y: borderY + headerHeight },
      thickness: 0.8,
      color: borderColor,
    });
    page.drawLine({
      start: { x: colTotalX - SPACING_XS / 2, y: borderY },
      end: { x: colTotalX - SPACING_XS / 2, y: borderY + headerHeight },
      thickness: 0.8,
      color: borderColor,
    });
    
    // Bordure horizontale en bas du header
    page.drawLine({
      start: { x: tableLeft, y: borderY },
      end: { x: tableLeft + tableWidth, y: borderY },
      thickness: 1.5,
      color: tokens.text,
    });
    
    // Texte header en noir (bien visible)
    const headerTextY = headerY - headerHeight / 2 - FONT_SIZE_NORMAL / 2;
    page.drawText("Type", {
      x: colTypeX + SPACING_XS,
      y: headerTextY,
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text,
    });
    page.drawText("Description", {
      x: colDescX + SPACING_XS,
      y: headerTextY,
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text,
    });
    page.drawText("Qté", {
      x: colQtyX + SPACING_XS,
      y: headerTextY,
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text,
    });
    page.drawText("PU HT", {
      x: colPuX + SPACING_XS,
      y: headerTextY,
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text,
    });
    page.drawText("Total HT", {
      x: colTotalX + SPACING_XS,
      y: headerTextY,
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text,
    });
    
    return headerY - headerHeight - SPACING_XS;
  };
  
  // Dessiner le header initial
  y = drawTableHeader(currentPage, y);
  
  // Grouper les lignes par type pour sections
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
    
    // Row group header : séparation visuelle propre
    if (rowIndex > 0) {
      y -= SPACING_MD;
      // Ligne de séparation fine
      currentPage.drawLine({
        start: { x: tableLeft, y },
        end: { x: PAGE_WIDTH - MARGIN_X, y },
        thickness: 0.5,
        color: tokens.border,
      });
      y -= SPACING_SM;
    }
    
    // Header de section sobre (pas de couleur)
    const sectionHeaderHeight = LINE_HEIGHT_NORMAL + SPACING_MD;
    const sectionLabel = typeLabels[type] || "AUTRES";
    
    // Ligne de séparation avant la section
    if (rowIndex > 0) {
      y -= SPACING_MD;
      currentPage.drawLine({
        start: { x: tableLeft, y },
        end: { x: PAGE_WIDTH - MARGIN_X, y },
        thickness: 1,
        color: tokens.border,
      });
      y -= SPACING_MD;
    }
    
    // Label section en uppercase (grand et bold, noir)
    currentPage.drawText(cleanTextForWinAnsi(sectionLabel), {
      x: tableLeft,
      y: y,
      size: FONT_SIZE_H2,
      font: fontBold,
      color: tokens.text,
    });
    
    // Calculer sous-total de section (aligné à droite, bien visible)
    const sectionSubtotal = lines.reduce((sum, line) => sum + line.totalHt, 0);
    const subtotalText = formatMoney(sectionSubtotal);
    currentPage.drawText(cleanTextForWinAnsi(subtotalText), {
      x: colTotalX + colTotalW - fontBold.widthOfTextAtSize(subtotalText, FONT_SIZE_H2),
      y: y,
      size: FONT_SIZE_H2,
      font: fontBold,
      color: tokens.text,
    });
    
    y -= sectionHeaderHeight + SPACING_XS;
    
    // Lignes de cette section
    for (const line of lines) {
      const minYForRow = MARGIN_Y + 100; // Espace pour footer
      if (y < minYForRow) {
        // Nouvelle page
        currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN_Y;
        
        // Répéter le header sur la nouvelle page
        y = drawTableHeader(currentPage, y);
        
        // Indicateur de suite
        currentPage.drawText(cleanTextForWinAnsi("(suite)"), {
          x: MARGIN_X,
          y: y + SPACING_SM,
          size: FONT_SIZE_TINY,
          font,
          color: tokens.textMuted,
        });
        y -= SPACING_MD;
      }
      
      const rowStartY = y;
      const descText = cleanTextForWinAnsi(line.description || "");
      const typeText = cleanTextForWinAnsi(line.typeLabel);
      
      // Wrap description (max 2 lignes)
      const descMaxWidth = colDescW - SPACING_XS * 2;
      const descLines = wrapText(descText, descMaxWidth, FONT_SIZE_SMALL, font);
      const numDescLines = Math.min(2, descLines.length); // Max 2 lignes
      const lineSpacing = FONT_SIZE_SMALL + 2;
      const rowHeight = Math.max(LINE_HEIGHT_NORMAL + 4, numDescLines * lineSpacing + SPACING_XS * 2);
      
      // Zebra très léger pour toutes les sections (alternance subtile)
      if (rowIndex % 2 === 1) {
        currentPage.drawRectangle({
          x: tableLeft,
          y: rowStartY - rowHeight,
          width: tableWidth,
          height: rowHeight,
          color: tokens.zebra,
        });
      }
      
      // Bordures verticales pour séparer les colonnes (fines mais visibles)
      const rowTopY = rowStartY - rowHeight;
      const borderColor = tokens.border;
      currentPage.drawLine({
        start: { x: colDescX - SPACING_XS / 2, y: rowTopY },
        end: { x: colDescX - SPACING_XS / 2, y: rowStartY },
        thickness: 0.5,
        color: borderColor,
      });
      currentPage.drawLine({
        start: { x: colQtyX - SPACING_XS / 2, y: rowTopY },
        end: { x: colQtyX - SPACING_XS / 2, y: rowStartY },
        thickness: 0.5,
        color: borderColor,
      });
      currentPage.drawLine({
        start: { x: colPuX - SPACING_XS / 2, y: rowTopY },
        end: { x: colPuX - SPACING_XS / 2, y: rowStartY },
        thickness: 0.5,
        color: borderColor,
      });
      currentPage.drawLine({
        start: { x: colTotalX - SPACING_XS / 2, y: rowTopY },
        end: { x: colTotalX - SPACING_XS / 2, y: rowStartY },
        thickness: 0.5,
        color: borderColor,
      });
      
      // Bordure horizontale en bas de la ligne (fine mais visible)
      currentPage.drawLine({
        start: { x: tableLeft, y: rowTopY },
        end: { x: tableLeft + tableWidth, y: rowTopY },
        thickness: 0.5,
        color: borderColor,
      });
      
      // Type (plus petit, discret)
      const typeY = rowStartY - rowHeight / 2 - FONT_SIZE_SMALL / 2;
      currentPage.drawText(typeText, {
        x: colTypeX + SPACING_XS,
        y: typeY,
        size: FONT_SIZE_SMALL,
        font,
        color: tokens.textSecondary,
      });
      
      // Description (multi-ligne, max 2, taille normale pour lisibilité)
      let descY = rowStartY - SPACING_XS - FONT_SIZE_NORMAL;
      for (let i = 0; i < numDescLines; i++) {
        const line = descLines[i];
        const lineWidth = font.widthOfTextAtSize(line, FONT_SIZE_NORMAL);
        if (lineWidth > descMaxWidth) {
          // Tronquer avec "..." si nécessaire
          let truncated = line;
          while (
            font.widthOfTextAtSize(truncated + "...", FONT_SIZE_NORMAL) > descMaxWidth &&
            truncated.length > 0
          ) {
            truncated = truncated.slice(0, -1);
          }
          currentPage.drawText(truncated + "...", {
            x: colDescX + SPACING_XS,
            y: descY,
            size: FONT_SIZE_NORMAL,
            font,
            color: tokens.text,
          });
        } else {
          currentPage.drawText(line, {
            x: colDescX + SPACING_XS,
            y: descY,
            size: FONT_SIZE_NORMAL,
            font,
            color: tokens.text,
          });
        }
        descY -= lineSpacing + 2;
      }
      
      // Quantité (format heures si labor, bien visible)
      const qtyY = rowStartY - rowHeight / 2 - FONT_SIZE_NORMAL / 2;
      const qtyText =
        line.type === "labor" ? formatHours(line.quantity) : String(line.quantity);
      currentPage.drawText(cleanTextForWinAnsi(qtyText), {
        x: colQtyX + SPACING_XS,
        y: qtyY,
        size: FONT_SIZE_NORMAL,
        font,
        color: tokens.text,
      });
      
      // Prix unitaire (aligné à droite, bien visible, taille normale)
      const puStr = formatMoney(line.unitPrice);
      const puY = rowStartY - rowHeight / 2 - FONT_SIZE_NORMAL / 2;
      currentPage.drawText(cleanTextForWinAnsi(puStr), {
        x: colPuX + colPuW - font.widthOfTextAtSize(puStr, FONT_SIZE_NORMAL),
        y: puY,
        size: FONT_SIZE_NORMAL,
        font: fontBold, // Bold pour visibilité
        color: tokens.text,
      });
      
      // Total HT (aligné à droite, GRAND et BOLD pour visibilité maximale)
      const totalStr = formatMoney(line.totalHt);
      const totalY = rowStartY - rowHeight / 2 - FONT_SIZE_NORMAL / 2;
      currentPage.drawText(cleanTextForWinAnsi(totalStr), {
        x: colTotalX + colTotalW - fontBold.widthOfTextAtSize(totalStr, FONT_SIZE_NORMAL + 1),
        y: totalY,
        size: FONT_SIZE_NORMAL + 1, // Plus grand pour visibilité
        font: fontBold, // Bold pour visibilité
        color: tokens.text,
      });
      
      y -= rowHeight + SPACING_XS;
      rowIndex++;
    }
  }
  
  y -= SPACING_MD;
  return { y, lastPage: currentPage };
}

/**
 * Dessine le bloc totaux premium (aligné à droite, accent_soft background)
 */
function drawPremiumTotalsBlock(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: PremiumThemeTokens,
  startY: number
): number {
  let y = startY;
  
  const totalsBoxWidth = 240;
  const totalsBoxX = PAGE_WIDTH - MARGIN_X - totalsBoxWidth;
  const totalsPadding = SPACING_MD;
  
  // Calculer la hauteur nécessaire
  let totalsHeight = totalsPadding * 2;
  totalsHeight += LINE_HEIGHT_NORMAL + SPACING_XS; // Total HT
  totalsHeight += LINE_HEIGHT_NORMAL + SPACING_XS; // TVA
  totalsHeight += SPACING_SM; // Séparation
  totalsHeight += FONT_SIZE_H2 + SPACING_XS; // TOTAL TTC
  totalsHeight += SPACING_SM; // Espace après TTC
  
  if (data.documentType === "facture" && data.paymentStatus) {
    totalsHeight += LINE_HEIGHT_COMPACT + SPACING_XS;
  }
  
  if (data.garage?.iban) {
    totalsHeight += LINE_HEIGHT_COMPACT * 2 + SPACING_XS;
  }
  
  // Card sobre avec bordure simple (pas de couleur)
  drawRoundedRect(page, totalsBoxX, y, totalsBoxWidth, totalsHeight, {
    borderColor: tokens.border,
    borderWidth: 2, // Bordure plus épaisse pour visibilité
    fillColor: rgb(0.98, 0.98, 0.98), // Fond très léger
  });
  
  // Ligne de séparation épaisse en haut
  page.drawLine({
    start: { x: totalsBoxX, y },
    end: { x: totalsBoxX + totalsBoxWidth, y },
    thickness: 2,
    color: tokens.text,
  });
  
  let totalsY = y - totalsPadding - 2;
  
  // Total HT (bien visible)
  page.drawText("Total HT", {
    x: totalsBoxX + totalsPadding,
    y: totalsY,
    size: FONT_SIZE_NORMAL + 1,
    font: fontBold,
    color: tokens.text,
  });
  const totalHtStr = formatMoney(data.totalHt);
  page.drawText(cleanTextForWinAnsi(totalHtStr), {
    x: totalsBoxX + totalsBoxWidth - totalsPadding - fontBold.widthOfTextAtSize(totalHtStr, FONT_SIZE_NORMAL + 1),
    y: totalsY,
    size: FONT_SIZE_NORMAL + 1,
    font: fontBold,
    color: tokens.text,
  });
  totalsY -= LINE_HEIGHT_NORMAL + SPACING_MD;
  
  // TVA (bien visible)
  const vatLabel = `TVA ${data.vatRate ?? 20} %`;
  page.drawText(cleanTextForWinAnsi(vatLabel), {
    x: totalsBoxX + totalsPadding,
    y: totalsY,
    size: FONT_SIZE_NORMAL + 1,
    font: fontBold,
    color: tokens.text,
  });
  const totalTvaStr = formatMoney(data.totalTva);
  page.drawText(cleanTextForWinAnsi(totalTvaStr), {
    x: totalsBoxX + totalsBoxWidth - totalsPadding - fontBold.widthOfTextAtSize(totalTvaStr, FONT_SIZE_NORMAL + 1),
    y: totalsY,
    size: FONT_SIZE_NORMAL + 1,
    font: fontBold,
    color: tokens.text,
  });
  totalsY -= LINE_HEIGHT_NORMAL + SPACING_MD;
  
  // Séparation épaisse avant TOTAL TTC
  page.drawLine({
    start: { x: totalsBoxX + totalsPadding, y: totalsY },
    end: { x: totalsBoxX + totalsBoxWidth - totalsPadding, y: totalsY },
    thickness: 2,
    color: tokens.text,
  });
  totalsY -= SPACING_MD;
  
  // TOTAL TTC (TRÈS GRAND et BOLD pour visibilité maximale)
  page.drawText("TOTAL TTC", {
    x: totalsBoxX + totalsPadding,
    y: totalsY,
    size: FONT_SIZE_H1 - 2, // Très grand
    font: fontBold,
    color: tokens.text,
  });
  const totalTtcStr = formatMoney(data.totalTtc);
  page.drawText(cleanTextForWinAnsi(totalTtcStr), {
    x: totalsBoxX + totalsBoxWidth - totalsPadding - fontBold.widthOfTextAtSize(totalTtcStr, FONT_SIZE_H1 - 2),
    y: totalsY,
    size: FONT_SIZE_H1 - 2, // Très grand
    font: fontBold,
    color: tokens.text,
  });
  totalsY -= FONT_SIZE_H1 + SPACING_MD;
  
  // "Net à payer" / "Montant total à régler" (visible)
  const netLabel = data.documentType === "facture" ? "Net à payer" : "Montant total";
  page.drawText(cleanTextForWinAnsi(netLabel), {
    x: totalsBoxX + totalsPadding,
    y: totalsY,
    size: FONT_SIZE_NORMAL,
    font: fontBold,
    color: tokens.text,
  });
  totalsY -= LINE_HEIGHT_NORMAL + SPACING_XS;
  
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
      size: FONT_SIZE_NORMAL,
      font: fontBold,
      color: tokens.text, // Noir pour visibilité
    });
    totalsY -= LINE_HEIGHT_COMPACT + SPACING_XS;
  }
  
  // Mini bloc Paiement (IBAN/BIC) si disponible
  if (data.garage?.iban) {
    totalsY -= SPACING_XS;
    page.drawText("Paiement", {
      x: totalsBoxX + totalsPadding,
      y: totalsY,
      size: FONT_SIZE_TINY,
      font: fontBold,
      color: tokens.textMuted,
    });
    totalsY -= LINE_HEIGHT_COMPACT;
    
    const ibanText = `IBAN: ${data.garage.iban}`;
    page.drawText(cleanTextForWinAnsi(ibanText), {
      x: totalsBoxX + totalsPadding,
      y: totalsY,
      size: FONT_SIZE_TINY,
      font,
      color: tokens.textSecondary,
    });
    totalsY -= LINE_HEIGHT_COMPACT;
    
    if (data.garage.bic) {
      const bicText = `BIC: ${data.garage.bic}`;
      page.drawText(cleanTextForWinAnsi(bicText), {
        x: totalsBoxX + totalsPadding,
        y: totalsY,
        size: FONT_SIZE_TINY,
        font,
        color: tokens.textSecondary,
      });
    }
  }
  
  y = totalsY - totalsPadding;
  return y;
}

/**
 * Dessine le footer premium (toutes pages)
 */
function drawPremiumFooter(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  tokens: PremiumThemeTokens,
  pageNumber: number,
  totalPages: number
): void {
  const footerY = MARGIN_Y;
  
  // Ligne de séparation fine
  page.drawLine({
    start: { x: MARGIN_X, y: footerY + SPACING_MD },
    end: { x: PAGE_WIDTH - MARGIN_X, y: footerY + SPACING_MD },
    thickness: 0.5,
    color: tokens.border_light,
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
    color: tokens.textMuted,
  });
  
  // Centre : Brand name ou "GarageOS"
  const brandName = data.garage?.name || "GarageOS";
  const brandWidth = font.widthOfTextAtSize(brandName, FONT_SIZE_TINY);
  page.drawText(cleanTextForWinAnsi(brandName), {
    x: PAGE_WIDTH / 2 - brandWidth / 2,
    y,
    size: FONT_SIZE_TINY,
    font,
    color: tokens.textMuted,
  });
  
  // Droite : Page X / Y
  const pageText = `Page ${pageNumber} / ${totalPages}`;
  page.drawText(cleanTextForWinAnsi(pageText), {
    x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(pageText, FONT_SIZE_TINY),
    y,
    size: FONT_SIZE_TINY,
    font,
    color: tokens.textMuted,
  });
  
  y -= LINE_HEIGHT_COMPACT + SPACING_XS;
  
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
  
  // Footer personnalisé ou par défaut
  const customFooter = data.pdfFooter?.trim();
  if (customFooter) {
    legalLines.push(customFooter);
  } else if (data.documentType === "devis") {
    legalLines.push(
      `Ce devis est valable ${data.quoteValidDays ?? 30} jours à compter de sa date d'émission, sauf indication contraire.`
    );
  }
  
  // Dessiner les mentions (max 2 lignes pour ne pas surcharger)
  for (const line of legalLines.slice(0, 2)) {
    if (y < MARGIN_Y - 30) break; // Limite basse
    const cleanedLine = cleanTextForWinAnsi(line);
    const wrappedLines = wrapText(
      cleanedLine,
      CONTENT_WIDTH,
      FONT_SIZE_TINY,
      font
    );
    for (const wrappedLine of wrappedLines.slice(0, 1)) {
      // Une seule ligne par mention pour garder propre
      if (y < MARGIN_Y - 30) break;
      page.drawText(wrappedLine.slice(0, 120), {
        x: MARGIN_X,
        y,
        size: FONT_SIZE_TINY,
        font,
        color: tokens.textMuted,
      });
      y -= LINE_HEIGHT_COMPACT;
    }
  }
  
  // "Généré via GarageOS" très petit et discret en bas
  y = MARGIN_Y - SPACING_XS;
  page.drawText(cleanTextForWinAnsi("Généré via GarageOS"), {
    x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize("Généré via GarageOS", FONT_SIZE_TINY - 1),
    y,
    size: FONT_SIZE_TINY - 1,
    font,
    color: tokens.textMuted,
  });
}

// Export des fonctions principales pour utilisation dans generate.ts
export {
  getPremiumThemeTokens,
  cleanTextForWinAnsi,
  formatMoney,
  formatDate,
  formatHours,
  wrapText,
  drawRoundedRect,
  embedLogoOrMonogram,
  drawPremiumHeader,
  drawPremiumClientVehicleBlock,
  drawPremiumLinesTable,
  drawPremiumTotalsBlock,
  drawPremiumFooter,
  withAlpha,
  isValidRgb,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN_X,
  MARGIN_Y,
  CONTENT_WIDTH,
  FONT_SIZE_H1,
  FONT_SIZE_H2,
  FONT_SIZE_NORMAL,
  FONT_SIZE_SMALL,
  FONT_SIZE_TINY,
  LINE_HEIGHT_NORMAL,
  LINE_HEIGHT_COMPACT,
  SPACING_XS,
  SPACING_SM,
  SPACING_MD,
  SPACING_LG,
  SPACING_XL,
};
