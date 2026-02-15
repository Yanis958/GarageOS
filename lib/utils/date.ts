/** Date relative en français : "il y a 2 h", "Aujourd'hui", "Hier", "il y a X jours" */
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const other = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - other.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) {
    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    return "Aujourd'hui";
  }
  if (diffDays === 1) return "Hier";
  if (diffDays >= 2 && diffDays <= 6) return `Il y a ${diffDays} jours`;
  if (diffDays === 7) return "Il y a 1 semaine";
  if (diffDays <= 13) return `Il y a ${diffDays} jours`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
