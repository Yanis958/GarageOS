/**
 * Génère des références lisibles pour les devis et factures
 * Format : DEV-001, DEV-002... pour les devis
 * Format : FAC-001, FAC-002... pour les factures
 */

type QuoteWithDate = {
  id: string;
  created_at: string;
  facture_number?: string | null;
};

/**
 * Génère un Map des références lisibles pour une liste de quotes
 * @param quotes Liste de quotes triée par date de création (plus ancien en premier)
 * @returns Map<quoteId, readableReference>
 */
export function generateReadableReferences(quotes: QuoteWithDate[]): Map<string, string> {
  const referenceMap = new Map<string, string>();
  
  // Séparer les devis et les factures
  const devis: QuoteWithDate[] = [];
  const factures: QuoteWithDate[] = [];
  
  for (const quote of quotes) {
    if (quote.facture_number) {
      factures.push(quote);
    } else {
      devis.push(quote);
    }
  }
  
  // Générer les références pour les devis
  devis.forEach((quote, index) => {
    const number = String(index + 1).padStart(3, "0");
    referenceMap.set(quote.id, `DEV-${number}`);
  });
  
  // Générer les références pour les factures
  factures.forEach((quote, index) => {
    const number = String(index + 1).padStart(3, "0");
    referenceMap.set(quote.id, `FAC-${number}`);
  });
  
  return referenceMap;
}

/**
 * Obtient la référence lisible pour un quote
 * @param quoteId ID du quote
 * @param referenceMap Map des références générées
 * @param fallbackReference Référence de fallback (ex: quote.reference ou hash)
 * @returns Référence lisible ou fallback
 */
export function getReadableReference(
  quoteId: string,
  referenceMap: Map<string, string>,
  fallbackReference?: string | null
): string {
  return referenceMap.get(quoteId) ?? fallbackReference ?? `#${quoteId.slice(0, 8)}`;
}
