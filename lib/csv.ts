/**
 * Utilitaires pour la génération de fichiers CSV compatibles Excel FR
 */

/**
 * Convertit un tableau de lignes en format CSV
 * @param rows Tableau de tableaux de chaînes (chaque ligne est un tableau de cellules)
 * @param options Options de formatage
 * @returns Chaîne CSV formatée
 */
export function toCsv(
  rows: (string | number | null | undefined)[][],
  options?: { delimiter?: string }
): string {
  const delimiter = options?.delimiter ?? ";"; // Excel FR utilise ;

  return rows
    .map((row) =>
      row
        .map((cell) => {
          // Normaliser null/undefined en chaîne vide
          if (cell === null || cell === undefined) return "";

          // Convertir les nombres en chaînes
          const str = String(cell);

          // Si la cellule contient le délimiteur, des guillemets ou des retours à la ligne, l'entourer de guillemets
          if (str.includes(delimiter) || str.includes('"') || str.includes("\n") || str.includes("\r")) {
            // Échapper les guillemets doubles en les doublant
            return `"${str.replace(/"/g, '""')}"`;
          }

          return str;
        })
        .join(delimiter)
    )
    .join("\n");
}
