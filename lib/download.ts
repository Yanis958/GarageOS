/**
 * Utilitaires pour le téléchargement de fichiers côté client
 */

/**
 * Télécharge un fichier texte dans le navigateur
 * @param filename Nom du fichier à télécharger
 * @param text Contenu texte du fichier
 * @param mimeType Type MIME (par défaut: text/csv;charset=utf-8)
 */
export function downloadTextFile(
  filename: string,
  text: string,
  mimeType: string = "text/csv;charset=utf-8"
): void {
  // Créer un Blob avec le contenu
  const blob = new Blob([text], { type: mimeType });

  // Créer une URL temporaire
  const url = URL.createObjectURL(blob);

  // Créer un élément <a> temporaire pour déclencher le téléchargement
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  // Ajouter au DOM, cliquer, puis retirer
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Nettoyer l'URL après un court délai
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);
}
