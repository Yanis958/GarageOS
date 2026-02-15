import { cn } from "@/lib/utils";

/** Mapping centralisé des statuts devis. Couleur : Bleu = Devis/CA, Orange = En attente/Envoyé/Expiré, Vert = Accepté, Gris = Brouillon */
export const QUOTE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-muted/50 text-muted-foreground border-muted" },
  sent: { label: "Envoyé", className: "bg-warning/15 text-warning border-warning/40" },
  accepted: { label: "Accepté", className: "bg-success/15 text-success border-success/40" },
  declined: { label: "Refusé", className: "bg-danger/15 text-danger border-danger/40" },
  expired: { label: "Expiré", className: "bg-warning/15 text-warning border-warning/40" },
  pending: { label: "En attente", className: "bg-warning/15 text-warning border-warning/40" },
};

export function getQuoteStatusLabel(status: string): string {
  return QUOTE_STATUS_CONFIG[String(status).toLowerCase()]?.label ?? status;
}

export function StatusBadge({
  status,
  isExpired,
  className,
}: {
  status: string;
  isExpired?: boolean;
  className?: string;
}) {
  const config = QUOTE_STATUS_CONFIG[String(status).toLowerCase()] ?? {
    label: status,
    className: "bg-muted/50 text-muted-foreground border-muted",
  };
  const label = isExpired && status === "sent" ? "Expiré" : config.label;
  const expiredClass = isExpired && status === "sent" ? "bg-warning/15 text-warning border-warning/40" : config.className;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tabular-nums transition-all duration-200",
        expiredClass,
        className
      )}
    >
      {label}
    </span>
  );
}
