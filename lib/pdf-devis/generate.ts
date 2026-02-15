import type { PdfDevisPayload } from "./types";
import { renderInvoicePdfV2 } from "./premium-v2";

// Note: PAGE_WIDTH, PAGE_HEIGHT, MARGIN_X, MARGIN_Y, CONTENT_WIDTH, FONT_SIZE_SMALL, LINE_HEIGHT_NORMAL, SPACING_MD
// sont maintenant importés depuis premium-template.ts
// Les constantes ci-dessous sont conservées pour compatibilité avec les anciennes fonctions
// qui ne sont plus utilisées mais pourraient être référencées ailleurs
const MARGIN_SMALL = 8;

// ---------- Typo (anciennes constantes, conservées pour compatibilité)
const FONT_SIZE_H1 = 20;
const FONT_SIZE_H2 = 12;
const FONT_SIZE_NORMAL = 10;
const ROW_HEIGHT = 18;

const LOGO_MAX_WIDTH = 120;
const LOGO_MAX_HEIGHT = 48;

// Note: cleanTextForWinAnsi et wrapText sont maintenant importés depuis premium-template.ts
// formatEuro est conservé localement car il utilise cleanTextForWinAnsi importé
function formatEuro(n: number): string {
  const formatted = new Intl.NumberFormat("fr-FR", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(n);
  return cleanTextForWinAnsi(formatted.replace(/\u202F/g, " ")) + " EUR";
}

// Note: embedLogo est conservé pour compatibilité avec les anciennes fonctions non utilisées
async function embedLogo(
  doc: PDFDocument,
  page: PDFPage,
  logoUrl: string,
  x: number,
  y: number
): Promise<number> {
  try {
    const res = await fetch(logoUrl, { mode: "cors" });
    if (!res.ok) return 0;
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
    if (w <= 0 || h <= 0) return 0;
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
  } catch {
    return 0;
  }
}

function drawHeader(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: ThemeTokens,
  startY: number
): number {
  let y = startY;
  const garage = data.garage;
  
  // Bandeau premium en haut (fine bande de couleur primaire)
  const bandHeight = 4;
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - bandHeight,
    width: PAGE_WIDTH,
    height: bandHeight,
    color: tokens.primary,
  });
  y -= bandHeight + MARGIN_X;
  
  // Logo à gauche
  let logoHeight = 0;
  let nameX = MARGIN_X;
  if (garage?.logo_url?.trim()) {
    // Logo sera intégré plus tard dans generateDevisPdf
    nameX = MARGIN_X + LOGO_MAX_WIDTH + 12;
  }
  
  // Nom du garage (plus grand et mis en valeur)
  const garageName = garage?.name?.trim() || "Garage";
  page.drawText(cleanTextForWinAnsi(garageName), {
    x: nameX,
    y,
    size: FONT_SIZE_H2 + 2,
    font: fontBold,
    color: tokens.primary,
  });
  
  // Infos garage à droite (adresse complète)
  const rightX = PAGE_WIDTH - MARGIN_X;
  const garageLines: string[] = [];
  if (garage?.address_line1?.trim()) garageLines.push(garage.address_line1.trim());
  if (garage?.address_line2?.trim()) garageLines.push(garage.address_line2.trim());
  if (garage?.postal_code && garage?.city) {
    garageLines.push(`${garage.postal_code} ${garage.city}`);
  } else if (garage?.postal_code) {
    garageLines.push(garage.postal_code);
  } else if (garage?.city) {
    garageLines.push(garage.city);
  }
  if (garage?.phone?.trim()) garageLines.push(`Tel. ${garage.phone.trim()}`);
  if (garage?.email?.trim()) garageLines.push(garage.email.trim());
  if (garage?.siret?.trim()) garageLines.push(`SIRET ${garage.siret.trim()}`);
  if (garage?.vat_intracom?.trim()) garageLines.push(`TVA ${garage.vat_intracom.trim()}`);
  
  let lineY = y;
  for (const line of garageLines) {
    const cleanedLine = cleanTextForWinAnsi(line);
    page.drawText(cleanedLine, {
      x: rightX - font.widthOfTextAtSize(cleanedLine, FONT_SIZE_SMALL),
      y: lineY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.textSecondary,
    });
    lineY -= FONT_SIZE_SMALL + 2;
  }
  
  const headerHeight = Math.max(logoHeight, garageLines.length * (FONT_SIZE_SMALL + 2), LINE_HEIGHT_NORMAL);
  y -= headerHeight + 8;
  
  // Ligne de séparation fine avec couleur primaire
  y -= MARGIN_SMALL;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 0.5,
    color: tokens.primary_100,
  });
  y -= 16;
  
  // Type de document + numéro + dates (design premium)
  const docType = data.documentType || "devis";
  const docTitle = docType === "facture" ? "FACTURE" : docType === "avoir" ? "AVOIR" : "DEVIS";
  
  // Titre du document (grand et en couleur primaire)
  page.drawText(docTitle, {
    x: MARGIN_X,
    y,
    size: FONT_SIZE_H1 + 2,
    font: fontBold,
    color: tokens.primary,
  });
  y -= FONT_SIZE_H1 + 6;
  
  // Numéro du document avec badge visuel
  const docNumber = docType === "facture" && data.factureNumber
    ? data.factureNumber
    : docType === "avoir" && data.creditNoteNumber
    ? data.creditNoteNumber
    : data.reference;
  
  // Badge visuel pour le numéro (fond léger primary)
  const badgeWidth = fontBold.widthOfTextAtSize(`N° ${docNumber}`, FONT_SIZE_NORMAL) + 12;
  page.drawRectangle({
    x: MARGIN_X,
    y: y - FONT_SIZE_NORMAL - 4,
    width: badgeWidth,
    height: FONT_SIZE_NORMAL + 6,
    color: tokens.primary_50,
  });
  
  page.drawText(cleanTextForWinAnsi(`N° ${docNumber}`), {
    x: MARGIN_X + 6,
    y: y - 2,
    size: FONT_SIZE_NORMAL,
    font: fontBold,
    color: tokens.primary_700,
  });
  y -= LINE_HEIGHT_NORMAL + 8;
  
  // Dates (alignées proprement)
  const dateInfo: string[] = [];
  if (data.createdAt) dateInfo.push(`Date de creation: ${data.createdAt}`);
  if (docType === "facture" || docType === "avoir") {
    if (data.issuedAt) dateInfo.push(`Date d'emission: ${data.issuedAt}`);
    if (data.dueDate && data.documentType === "facture") {
      dateInfo.push(`Echeance: ${data.dueDate}`);
    }
  } else {
    if (data.validUntil) dateInfo.push(`Valide jusqu'au: ${data.validUntil}`);
  }
  
  for (const dateLine of dateInfo) {
    page.drawText(cleanTextForWinAnsi(dateLine), {
      x: MARGIN_X,
      y,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.textSecondary,
    });
    y -= LINE_HEIGHT_NORMAL + 2;
  }
  
  y -= 8;
  return y;
}

function drawClientVehicleBlock(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: ThemeTokens,
  startY: number
): number {
  let y = startY;
  
  const boxWidth = 240;
  const boxX = MARGIN_X;
  const boxHeight = 100;
  
  // Bloc gauche : Informations document (design premium avec bordure subtile)
  page.drawRectangle({
    x: boxX,
    y: y - boxHeight,
    width: boxWidth,
    height: boxHeight,
    borderColor: tokens.border,
    borderWidth: 0.5,
  });
  
  // Header du bloc avec fond léger primary
  page.drawRectangle({
    x: boxX,
    y: y - 18,
    width: boxWidth,
    height: 18,
    color: tokens.primary_50,
  });
  
  let infoY = y - 12;
  const labelX = boxX + 8;
  const valueX = boxX + 110;
  
  const refLabel = data.documentType === "facture" ? "Reference facture" : data.documentType === "avoir" ? "Reference avoir" : "Reference";
  const refValue = data.documentType === "facture" && data.factureNumber
    ? data.factureNumber
    : data.documentType === "avoir" && data.creditNoteNumber
    ? data.creditNoteNumber
    : data.reference;
  
  page.drawText(cleanTextForWinAnsi(refLabel), {
    x: labelX,
    y: infoY,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.primary_700,
  });
  page.drawText(cleanTextForWinAnsi(refValue), {
    x: valueX,
    y: infoY,
    size: FONT_SIZE_SMALL,
    font,
    color: tokens.text,
  });
  infoY -= LINE_HEIGHT + 4;
  
  if (data.createdAt) {
    page.drawText("Date de creation", {
      x: labelX,
      y: infoY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: tokens.textSecondary,
    });
    page.drawText(cleanTextForWinAnsi(data.createdAt), {
      x: valueX,
      y: infoY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.text,
    });
    infoY -= LINE_HEIGHT_NORMAL + 4;
  }
  
  const dateLabel = data.documentType === "facture" || data.documentType === "avoir"
    ? "Date d'emission"
    : "Valide jusqu'au";
  const dateValue = data.documentType === "facture" || data.documentType === "avoir"
    ? (data.issuedAt || data.createdAt || "—")
    : data.validUntil;
  
  page.drawText(cleanTextForWinAnsi(dateLabel), {
    x: labelX,
    y: infoY,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.textSecondary,
  });
  page.drawText(cleanTextForWinAnsi(dateValue), {
    x: valueX,
    y: infoY,
    size: FONT_SIZE_SMALL,
    font,
    color: tokens.text,
  });
  
  // Bloc droit : Informations client/véhicule (design premium)
  const clientBoxWidth = boxWidth + 20;
  const clientBoxX = PAGE_WIDTH - MARGIN_X - clientBoxWidth;
  const clientBoxHeight = 120;
  
  page.drawRectangle({
    x: clientBoxX,
    y: y - clientBoxHeight,
    width: clientBoxWidth,
    height: clientBoxHeight,
    borderColor: tokens.border,
    borderWidth: 0.5,
  });
  
  // Header du bloc client avec fond léger accent
  page.drawRectangle({
    x: clientBoxX,
    y: y - 18,
    width: clientBoxWidth,
    height: 18,
    color: tokens.accent_50,
  });
  
  let clientY = y - 12;
  const clientLabelX = clientBoxX + 8;
  const clientValueX = clientBoxX + 75;
  const clientValueWidth = clientBoxWidth - 85;
  
  // Client (header du bloc)
  page.drawText("Client", {
    x: clientLabelX,
    y: clientY,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.accent_600,
  });
  const clientNameLines = wrapText(cleanTextForWinAnsi(data.client.name), clientValueWidth, FONT_SIZE_SMALL, font);
  page.drawText(clientNameLines[0], {
    x: clientValueX,
    y: clientY,
    size: FONT_SIZE_SMALL,
    font,
    color: tokens.text,
  });
  clientY -= LINE_HEIGHT + 2;
  
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
    const addressLines = wrapText(cleanTextForWinAnsi(addressText), clientValueWidth, FONT_SIZE_SMALL, font);
    for (let i = 0; i < Math.min(addressLines.length, 2); i++) {
      page.drawText(addressLines[i], {
        x: clientValueX,
        y: clientY,
        size: FONT_SIZE_SMALL,
        font,
        color: tokens.text,
      });
      clientY -= LINE_HEIGHT_NORMAL + 2;
    }
  }
  
  // Email/Téléphone client
  if (data.client.email || data.client.phone) {
    const contactInfo = [data.client.email, data.client.phone].filter(Boolean).join(" / ");
    page.drawText(cleanTextForWinAnsi(contactInfo), {
      x: clientValueX,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.text,
    });
    clientY -= LINE_HEIGHT_NORMAL + 4;
  }
  
  // Véhicule
  page.drawText("Vehicule", {
    x: clientLabelX,
    y: clientY,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.textSecondary,
  });
  const vehicleParts = [
    data.vehicle.brand,
    data.vehicle.model,
  ].filter(Boolean);
  const vehicleLabel = vehicleParts.length > 0 ? vehicleParts.join(" ") : "—";
  const vehicleLines = wrapText(cleanTextForWinAnsi(vehicleLabel), clientValueWidth, FONT_SIZE_SMALL, font);
  page.drawText(vehicleLines[0], {
    x: clientValueX,
    y: clientY,
    size: FONT_SIZE_SMALL,
    font,
    color: tokens.text,
  });
  clientY -= LINE_HEIGHT + 2;
  
  // Immatriculation
  if (data.vehicle.registration) {
    page.drawText("Immatriculation", {
      x: clientLabelX,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: tokens.textSecondary,
    });
    const immatText = cleanTextForWinAnsi(data.vehicle.registration);
    const immatLines = wrapText(immatText, clientValueWidth, FONT_SIZE_SMALL, font);
    page.drawText(immatLines[0], {
      x: clientValueX,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.text,
    });
    clientY -= LINE_HEIGHT_NORMAL + 2;
  }
  
  // VIN
  if (data.vehicle.vin) {
    page.drawText("VIN", {
      x: clientLabelX,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: tokens.textSecondary,
    });
    const vinLines = wrapText(cleanTextForWinAnsi(data.vehicle.vin), clientValueWidth, FONT_SIZE_SMALL, font);
    page.drawText(vinLines[0], {
      x: clientValueX,
      y: clientY,
      size: FONT_SIZE_SMALL,
      font,
      color: tokens.text,
    });
  }
  
  y -= Math.max(boxHeight, clientBoxHeight) + 8;
  return y;
}

function drawLinesTable(
  doc: PDFDocument,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: ThemeTokens,
  startY: number
): { y: number; lastPage: PDFPage } {
  let y = startY;
  let currentPage = doc.getPage(0);
  
  const tableLeft = MARGIN_X;
  const tableWidth = PAGE_WIDTH - 2 * MARGIN_X;
  const colTypeW = 70;
  const colDescW = 280;
  const colQtyW = 45;
  const colPuW = 85;
  const colTotalW = 85;
  
  const colTypeX = tableLeft;
  const colDescX = colTypeX + colTypeW + 8;
  const colQtyX = colDescX + colDescW + 8;
  const colPuX = colQtyX + colQtyW + 8;
  const colTotalX = colPuX + colPuW + 8;
  
  // En-tête du tableau (design premium avec couleur primaire)
  const headerY = y;
  const headerHeight = 24;
  currentPage.drawRectangle({
    x: tableLeft,
    y: headerY - headerHeight + 4,
    width: tableWidth,
    height: headerHeight,
    color: tokens.primary_600,
  });
  currentPage.drawText("Type", {
    x: colTypeX + 6,
    y: headerY - 14,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.white,
  });
  currentPage.drawText("Description", {
    x: colDescX + 6,
    y: headerY - 14,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.white,
  });
  currentPage.drawText("Qte", {
    x: colQtyX + 6,
    y: headerY - 14,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.white,
  });
  currentPage.drawText("Prix u. HT", {
    x: colPuX + 6,
    y: headerY - 14,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.white,
  });
  currentPage.drawText("Total HT", {
    x: colTotalX + 6,
    y: headerY - 14,
    size: FONT_SIZE_SMALL,
    font: fontBold,
    color: tokens.white,
  });
  y -= headerHeight + 6;
  
  // Grouper les lignes par type pour séparation visuelle
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
  
  let rowIndex = 0;
  const typeLabels: Record<string, string> = {
    part: "PIECES",
    labor: "MAIN-D'OEUVRE",
    forfait: "FORFAITS",
  };
  
  for (const [type, lines] of Object.entries(linesByType)) {
    if (lines.length === 0) continue;
    
    // Sous-titre pour le type
    if (rowIndex > 0) {
      y -= 8;
      currentPage.drawLine({
        start: { x: tableLeft, y },
        end: { x: PAGE_WIDTH - MARGIN_X, y },
        thickness: 0.5,
        color: tokens.border,
      });
      y -= 6;
    }
    
    // Sous-titre avec fond léger primary
    const subtitleWidth = fontBold.widthOfTextAtSize(typeLabels[type] || "AUTRES", FONT_SIZE_SMALL) + 8;
    currentPage.drawRectangle({
      x: tableLeft,
      y: y - FONT_SIZE_SMALL - 2,
      width: subtitleWidth,
      height: FONT_SIZE_SMALL + 4,
      color: tokens.primary_50,
    });
    currentPage.drawText(cleanTextForWinAnsi(typeLabels[type] || "AUTRES"), {
      x: tableLeft + 4,
      y,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: tokens.primary_700,
    });
    y -= LINE_HEIGHT_NORMAL + 4;
    
    // Lignes de ce type
    for (const line of lines) {
      const minYForRow = MARGIN_X + 120;
      if (y < minYForRow) {
        currentPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN_X;
        currentPage.drawText("(suite)", {
          x: MARGIN_X,
          y,
          size: FONT_SIZE_SMALL,
          font,
          color: tokens.textMuted,
        });
        y -= ROW_HEIGHT + 8;
        rowIndex = 0;
      }
      
      const rowStartY = y;
      const descText = cleanTextForWinAnsi(line.description || "");
      const typeText = cleanTextForWinAnsi(line.typeLabel);
      
      const descMaxWidth = colDescW - 12;
      const descLines = wrapText(descText, descMaxWidth, FONT_SIZE_SMALL, font);
      const numDescLines = Math.max(1, descLines.length);
      const lineSpacing = FONT_SIZE_SMALL + 4;
      const rowHeight = Math.max(ROW_HEIGHT + 4, numDescLines * lineSpacing + 8);
      
      // Fond zebra (alternance subtile)
      if (rowIndex % 2 === 1) {
        currentPage.drawRectangle({
          x: tableLeft,
          y: rowStartY - rowHeight + 4,
          width: tableWidth,
          height: rowHeight,
          color: tokens.zebra,
        });
      }
      
      // Type
      const typeY = rowStartY - (rowHeight / 2) - (FONT_SIZE_SMALL / 2);
      currentPage.drawText(typeText, {
        x: colTypeX + 6,
        y: typeY,
        size: FONT_SIZE_SMALL,
        font,
        color: tokens.text,
      });
      
      // Description
      let descY = rowStartY - 10;
      for (const descLine of descLines) {
        const lineWidth = font.widthOfTextAtSize(descLine, FONT_SIZE_SMALL);
        if (lineWidth > descMaxWidth) {
          let truncated = descLine;
          while (font.widthOfTextAtSize(truncated + "...", FONT_SIZE_SMALL) > descMaxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
          }
          currentPage.drawText(truncated + "...", {
            x: colDescX + 6,
            y: descY,
            size: FONT_SIZE_SMALL,
            font,
            color: tokens.text,
          });
        } else {
          currentPage.drawText(descLine, {
            x: colDescX + 6,
            y: descY,
            size: FONT_SIZE_SMALL,
            font,
            color: tokens.text,
          });
        }
        descY -= lineSpacing;
      }
      
      // Quantité
      const qtyY = rowStartY - (rowHeight / 2) - (FONT_SIZE_SMALL / 2);
      currentPage.drawText(String(line.quantity), {
        x: colQtyX + 6,
        y: qtyY,
        size: FONT_SIZE_SMALL,
        font,
        color: tokens.text,
      });
      
      // Prix unitaire
      const puStr = formatEuro(line.unitPrice);
      const puY = rowStartY - (rowHeight / 2) - (FONT_SIZE_SMALL / 2);
      currentPage.drawText(cleanTextForWinAnsi(puStr), {
        x: colPuX + colPuW - font.widthOfTextAtSize(puStr, FONT_SIZE_SMALL),
        y: puY,
        size: FONT_SIZE_SMALL,
        font,
        color: tokens.text,
      });
      
      // Total HT
      const totalStr = formatEuro(line.totalHt);
      const totalY = rowStartY - (rowHeight / 2) - (FONT_SIZE_SMALL / 2);
      currentPage.drawText(cleanTextForWinAnsi(totalStr), {
        x: colTotalX + colTotalW - font.widthOfTextAtSize(totalStr, FONT_SIZE_SMALL),
        y: totalY,
        size: FONT_SIZE_SMALL,
        font,
        color: tokens.text,
      });
      
      y -= rowHeight + 4;
      rowIndex++;
    }
  }
  
  y -= 8;
  return { y, lastPage: currentPage };
}

function drawTotalsBlock(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  fontBold: PDFFont,
  tokens: ThemeTokens,
  startY: number
): number {
  let y = startY;
  
  const totalsBoxWidth = 220;
  const totalsBoxX = PAGE_WIDTH - MARGIN_X - totalsBoxWidth;
  const totalsBoxHeight = data.documentType === "facture" && data.paymentStatus ? 100 : 80;
  
  // Bloc totaux avec bordure premium et fond léger
  page.drawRectangle({
    x: totalsBoxX - 8,
    y: y - totalsBoxHeight,
    width: totalsBoxWidth + 16,
    height: totalsBoxHeight,
    borderColor: tokens.primary_100,
    borderWidth: 1.5,
  });
  
  // Fond léger pour le bloc totaux
  page.drawRectangle({
    x: totalsBoxX - 7,
    y: y - totalsBoxHeight + 1,
    width: totalsBoxWidth + 14,
    height: totalsBoxHeight - 2,
    color: tokens.primary_50,
  });
  
  let totalsY = y - 14;
  
  // Total HT
  page.drawText("Total HT", {
    x: totalsBoxX,
    y: totalsY,
    size: FONT_SIZE_NORMAL,
    font,
    color: tokens.textSecondary,
  });
  const totalHtStr = formatEuro(data.totalHt);
  page.drawText(cleanTextForWinAnsi(totalHtStr), {
    x: totalsBoxX + totalsBoxWidth - font.widthOfTextAtSize(totalHtStr, FONT_SIZE_NORMAL),
    y: totalsY,
    size: FONT_SIZE_NORMAL,
    font,
    color: tokens.text,
  });
    totalsY -= LINE_HEIGHT_NORMAL + 4;
  
  // TVA
  const vatLabel = `TVA ${data.vatRate ?? 20} %`;
  page.drawText(cleanTextForWinAnsi(vatLabel), {
    x: totalsBoxX,
    y: totalsY,
    size: FONT_SIZE_NORMAL,
    font,
    color: tokens.textSecondary,
  });
  const totalTvaStr = formatEuro(data.totalTva);
  page.drawText(cleanTextForWinAnsi(totalTvaStr), {
    x: totalsBoxX + totalsBoxWidth - font.widthOfTextAtSize(totalTvaStr, FONT_SIZE_NORMAL),
    y: totalsY,
    size: FONT_SIZE_NORMAL,
    font,
    color: tokens.text,
  });
    totalsY -= LINE_HEIGHT_NORMAL + 6;
  
  // Ligne de séparation avant TOTAL TTC
  page.drawLine({
    start: { x: totalsBoxX, y: totalsY },
    end: { x: totalsBoxX + totalsBoxWidth, y: totalsY },
    thickness: 0.5,
    color: tokens.border,
  });
  totalsY -= 6;
  
  // TOTAL TTC (très mis en avant avec couleur primaire)
  page.drawText("TOTAL TTC", {
    x: totalsBoxX,
    y: totalsY,
    size: FONT_SIZE_H2 + 2,
    font: fontBold,
    color: tokens.primary,
  });
  const totalTtcStr = formatEuro(data.totalTtc);
  page.drawText(cleanTextForWinAnsi(totalTtcStr), {
    x: totalsBoxX + totalsBoxWidth - fontBold.widthOfTextAtSize(totalTtcStr, FONT_SIZE_H2 + 2),
    y: totalsY,
    size: FONT_SIZE_H2 + 2,
    font: fontBold,
    color: tokens.primary,
  });
    totalsY -= LINE_HEIGHT_NORMAL + 8;
  
  // Statut de paiement (pour les factures)
  if (data.documentType === "facture" && data.paymentStatus) {
    let statusText = "";
    if (data.paymentStatus === "paid") {
      statusText = data.paymentDate
        ? `Paye le ${data.paymentDate}`
        : "Paye";
      if (data.paymentMethod) {
        statusText += ` (${data.paymentMethod})`;
      }
    } else if (data.paymentStatus === "partial") {
      statusText = "Paiement partiel";
    } else {
      statusText = data.dueDate
        ? `A payer avant le ${data.dueDate}`
        : "A payer";
    }
    
    page.drawText(cleanTextForWinAnsi(statusText), {
      x: totalsBoxX,
      y: totalsY,
      size: FONT_SIZE_SMALL,
      font: fontBold,
      color: data.paymentStatus === "paid" ? tokens.success : tokens.textSecondary,
    });
    totalsY -= LINE_HEIGHT_NORMAL;
  }
  
  y = totalsY - 8;
  return y;
}

function drawFooter(
  page: PDFPage,
  data: PdfDevisPayload,
  font: PDFFont,
  tokens: ThemeTokens,
  pageNumber: number,
  totalPages: number
): void {
  let y = 50;
  
  // Ligne de séparation fine avant footer
  page.drawLine({
    start: { x: MARGIN_X, y: y + 10 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: y + 10 },
    thickness: 0.5,
    color: tokens.border,
  });
  y -= 4;
  
  const footerLines: string[] = [];
  
  // Mentions légales du garage
  if (data.garage?.legal_mentions?.trim()) {
    footerLines.push(data.garage.legal_mentions.trim());
  }
  
  // Conditions de paiement
  if (data.garage?.payment_terms?.trim()) {
    footerLines.push(`Conditions de paiement: ${data.garage.payment_terms.trim()}`);
  }
  
  // Pénalités de retard
  if (data.garage?.late_payment_penalties?.trim()) {
    footerLines.push(`Penalites de retard: ${data.garage.late_payment_penalties.trim()}`);
  }
  
  // IBAN/BIC si disponible
  if (data.garage?.iban?.trim()) {
    const ibanLine = data.garage.bic?.trim()
      ? `IBAN: ${data.garage.iban.trim()} - BIC: ${data.garage.bic.trim()}`
      : `IBAN: ${data.garage.iban.trim()}`;
    footerLines.push(ibanLine);
  }
  
  // Footer personnalisé ou par défaut
  const customFooter = data.pdfFooter?.trim();
  if (customFooter) {
    footerLines.push(customFooter);
  } else if (data.documentType === "devis") {
    footerLines.push(
      `Ce devis est valable ${data.quoteValidDays ?? 30} jours a compter de sa date d'emission, sauf indication contraire.`
    );
  }
  
  // Dessiner les lignes du footer
  for (const line of footerLines) {
    if (y < 30) break;
    const cleanedLine = cleanTextForWinAnsi(line);
    const wrappedLines = wrapText(cleanedLine, PAGE_WIDTH - 2 * MARGIN_X, 8, font);
    for (const wrappedLine of wrappedLines.slice(0, 2)) {
      if (y < 30) break;
      page.drawText(wrappedLine.slice(0, 100), {
        x: MARGIN_X,
        y,
        size: 8,
        font,
        color: tokens.textMuted,
      });
      y -= 10;
    }
  }
  
  // Numéro de page en bas à droite
  const pageText = `Page ${pageNumber}/${totalPages}`;
  page.drawText(cleanTextForWinAnsi(pageText), {
    x: PAGE_WIDTH - MARGIN_X - font.widthOfTextAtSize(pageText, 8),
    y: 20,
    size: 8,
    font,
    color: tokens.textMuted,
  });
  
  // "Document généré via GarageOS" en bas à gauche
  page.drawText(cleanTextForWinAnsi("Document genere via GarageOS"), {
    x: MARGIN_X,
    y: 20,
    size: 8,
    font,
    color: tokens.textMuted,
  });
}

/** Génère un PDF de devis/facture/avoir premium V2 (luxe, corporate, zéro bug) */
export async function generateDevisPdf(data: PdfDevisPayload): Promise<Uint8Array> {
  // Utiliser le nouveau moteur V2
  return renderInvoicePdfV2(data);
}
