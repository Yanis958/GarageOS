import { ChevronRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardCard({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

type KPIAccent = "quote" | "warning" | "success";

const accentBorder: Record<KPIAccent, string> = {
  quote: "border-l-[4px] border-l-quote",
  warning: "border-l-[4px] border-l-warning",
  success: "border-l-[4px] border-l-success",
};

const accentBg: Record<KPIAccent, string> = {
  quote: "bg-gradient-to-br from-quote/20 to-quote/10 text-quote",
  warning: "bg-gradient-to-br from-warning/20 to-warning/10 text-warning",
  success: "bg-gradient-to-br from-success/20 to-success/10 text-success",
};

export function KPICard({
  href,
  accent,
  icon: Icon,
  label,
  value,
  subtext,
  actionLink,
  className,
  /** Mettre en avant (ex. CA du mois) — valeur plus grande */
  highlight,
  /** Micro-texte explicatif sous la valeur */
  explanation,
  /** Indicateur d'évolution : { value: nombre, period: "semaine" | "mois", isPositive: boolean } */
  evolution,
}: {
  href: string;
  accent: KPIAccent;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string | null;
  /** Lien optionnel (ex. "Voir à relancer") affiché sous le subtext */
  actionLink?: { label: string; href: string };
  className?: string;
  highlight?: boolean;
  /** Micro-texte explicatif sous la valeur */
  explanation?: string | null;
  /** Indicateur d'évolution : { value: nombre, period: "semaine" | "mois", isPositive: boolean } */
  evolution?: { value: number; period: "semaine" | "mois"; isPositive: boolean } | null;
}) {
  const cardClass = cn(
    "group relative flex flex-col rounded-card border border-border bg-card p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
    accentBorder[accent],
    className
  );

  const mainContent = (
    <>
      <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shadow-sm", accentBg[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-2 font-bold text-foreground tabular-nums", highlight ? "text-3xl" : "text-2xl")}>
        {value}
      </p>
      {explanation && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/80 leading-tight">
          {explanation}
        </p>
      )}
      {evolution && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px]">
          {evolution.isPositive ? (
            <TrendingUp className="h-3 w-3 text-success" />
          ) : (
            <TrendingDown className="h-3 w-3 text-destructive" />
          )}
          <span className={cn("font-medium", evolution.isPositive ? "text-success" : "text-destructive")}>
            {evolution.isPositive ? "+" : ""}
            {evolution.value > 0 ? evolution.value.toFixed(0) : "0"}
            {typeof evolution.value === "number" && evolution.value !== 0 && "%"}
          </span>
          <span className="text-muted-foreground/70">
            vs {evolution.period} précédente
          </span>
        </div>
      )}
      {subtext != null && subtext !== "" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {subtext}
        </p>
      )}
      <ChevronRight className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/40 transition-all duration-200 group-hover:opacity-100 group-hover:text-foreground group-hover:translate-x-0.5" aria-hidden />
    </>
  );

  if (actionLink) {
    return (
      <div className={cardClass}>
        <a href={href} className="block flex-1">
          {mainContent}
        </a>
        <p className="mt-3">
          <a
            href={actionLink.href}
            className="text-xs font-semibold text-warning hover:underline transition-colors duration-150"
          >
            {actionLink.label}
          </a>
        </p>
      </div>
    );
  }

  return <a href={href} className={cardClass}>{mainContent}</a>;
}
