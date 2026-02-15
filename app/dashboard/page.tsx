import Link from "next/link";
import {
  getDashboardStats,
  getQuotes,
} from "@/lib/actions/quotes";
import { KPICard } from "@/components/dashboard/DashboardCard";
import { ActivityChartCard } from "@/components/dashboard/ActivityChartCard";
import { Button } from "@/components/ui/button";
import {
  Target,
  Clock,
  CheckCircle,
  LayoutDashboard,
  Activity,
} from "lucide-react";

export default async function DashboardHome() {
  const [stats, allQuotes] = await Promise.all([
    getDashboardStats(),
    getQuotes(),
  ]);

  const caEvolution =
    stats.totalAcceptedTtcLastWeek > 0 && stats.previousMonthAmount > 0
      ? {
          value: ((stats.totalAcceptedTtcThisMonth - stats.previousMonthAmount) / stats.previousMonthAmount) * 100,
          period: "mois" as const,
          isPositive: stats.totalAcceptedTtcThisMonth >= stats.previousMonthAmount,
        }
      : null;

  const acceptedSubtext =
    stats.acceptedThisMonth === 0
      ? null
      : `${stats.totalAcceptedTtcThisMonth.toFixed(2)} € TTC acceptés`;

  const conversionRate =
    stats.quotesThisMonth > 0
      ? ((stats.acceptedThisMonth / stats.quotesThisMonth) * 100).toFixed(1)
      : "0.0";

  const argentEnAttente = allQuotes
    .filter((q) => q.status === "sent")
    .reduce((sum, q) => sum + (Number(q.total_ttc) || 0), 0);

  const todayDate = new Date();
  const threeDaysAgo = new Date(todayDate.getTime() - 3 * 24 * 60 * 60 * 1000);
  const devisARelancerList = allQuotes.filter((q) => {
    if (q.status !== "sent") return false;
    const created = new Date(q.created_at);
    return created < threeDaysAgo;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tableau de bord
        </h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <LayoutDashboard className="h-4 w-4" />
          Vue d&apos;ensemble · Ce mois
        </p>
      </div>

      {/* 1. Ligne KPI principale (4 cartes) */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <KPICard
            href="/dashboard/devis?status=accepted"
            accent="quote"
            icon={Target}
            label="CA CE MOIS"
            value={`${stats.totalAcceptedTtcThisMonth.toFixed(0)} €`}
            subtext={stats.previousMonthAmount > 0 ? `vs ${stats.previousMonthAmount.toFixed(0)} € mois dernier` : null}
            explanation="Chiffre d'affaires accepté ce mois"
            evolution={caEvolution}
            highlight
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <KPICard
            href="/dashboard/devis?status=sent"
            accent="warning"
            icon={Clock}
            label="DEVIS EN ATTENTE"
            value={allQuotes.filter((q) => q.status === "sent").length}
            subtext={argentEnAttente > 0 ? `${argentEnAttente.toFixed(0)} € potentiel` : "Envoyés sans réponse"}
            explanation="Devis envoyés en attente de réponse"
            actionLink={{ label: "Voir à relancer", href: "/dashboard/devis?toRelance=1" }}
            className="ring-1 ring-warning/20"
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <KPICard
            href="/dashboard/devis?status=accepted"
            accent="success"
            icon={CheckCircle}
            label="ACCEPTÉS CE MOIS"
            value={stats.acceptedThisMonth}
            subtext={acceptedSubtext}
            explanation="Devis acceptés ce mois"
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <KPICard
            href="/dashboard/devis"
            accent="quote"
            icon={Activity}
            label="TAUX DE CONVERSION"
            value={`${conversionRate}%`}
            subtext={stats.quotesThisMonth > 0 ? `${stats.acceptedThisMonth}/${stats.quotesThisMonth} devis` : "Aucun devis"}
            explanation="Taux d'acceptation ce mois"
          />
        </div>
      </div>

      {/* 2. Section principale : Activité devis (graphique seul) */}
      <div className="max-w-4xl mx-auto">
        <div className="rounded-card border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">
            Activité devis
          </h2>
          <ActivityChartCard />
        </div>
      </div>

      {/* 3. Section stratégique : Devis à relancer */}
      <div className="max-w-4xl mx-auto">
        <div className="rounded-card border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              🔥 Devis à relancer
            </h2>
            {devisARelancerList.length > 0 && (
              <Link
                href="/dashboard/devis?toRelance=1"
                className="text-xs font-medium text-primary hover:underline transition-colors duration-200"
              >
                Voir tout
              </Link>
            )}
          </div>
          {devisARelancerList.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-foreground">Tous vos devis sont à jour.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {devisARelancerList.slice(0, 8).map((q) => {
                const clientName =
                  q.clients && typeof q.clients === "object" && "name" in q.clients
                    ? (q.clients as { name: string | null }).name ?? "—"
                    : "—";
                const ref = q.reference ?? `#${q.id?.slice(0, 8) ?? ""}`;
                const amount = Number(q.total_ttc ?? 0);
                const dateEnvoi = new Date(q.created_at).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <div
                    key={q.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-amber-200/50 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-900/20"
                  >
                    <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-4 gap-y-0.5">
                      <span className="font-semibold text-foreground">{ref}</span>
                      <span className="text-sm text-muted-foreground truncate">{clientName}</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{amount.toFixed(0)} €</span>
                      <span className="text-xs text-muted-foreground">{dateEnvoi}</span>
                    </div>
                    <Button asChild size="sm" variant="default" className="rounded-button shrink-0 bg-amber-600 hover:bg-amber-700">
                      <Link href={`/dashboard/devis/${q.id}`}>Relancer</Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
