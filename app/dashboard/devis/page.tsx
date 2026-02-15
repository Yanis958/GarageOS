import Link from "next/link";
import { getQuotes } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, Plus } from "lucide-react";
import { DevisRowActions } from "@/app/dashboard/devis/DevisRowActions";
import { Badge } from "@/components/ui/badge";
import { EntityActionsMenu } from "@/components/archive-actions/EntityActionsMenu";
import { ExportDevisDropdown } from "@/components/dashboard/ExportDevisDropdown";
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";
import { GenerateMissingFacturesButton } from "@/components/dashboard/GenerateMissingFacturesButton";

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyé" },
  { value: "accepted", label: "Accepté" },
  { value: "declined", label: "Refusé" },
  { value: "expired", label: "Expiré" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "Toutes les périodes" },
  { value: "this_month", label: "Ce mois" },
  { value: "last_30", label: "30 derniers jours" },
];

function buildDevisListUrl({
  archived,
  params,
}: {
  archived: boolean;
  params: { q?: string; status?: string; period?: string; expired?: string; toRelance?: string; facture_number?: string };
}) {
  const search = new URLSearchParams();
  if (archived) search.set("archived", "1");
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.period && params.period !== "all") search.set("period", params.period);
  if (params.expired === "1") search.set("expired", "1");
  if (params.toRelance === "1") search.set("toRelance", "1");
  if (params.facture_number === "not_null") search.set("facture_number", "not_null");
  const qs = search.toString();
  return qs ? `/dashboard/devis?${qs}` : "/dashboard/devis";
}

export default async function DevisPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    period?: string;
    expired?: string;
    toRelance?: string;
    archived?: string;
    facture_number?: string;
  }>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const statusFilter = typeof params.status === "string" ? params.status : undefined;
  const period: "all" | "this_month" | "last_30" =
    typeof params.period === "string" && ["all", "this_month", "last_30"].includes(params.period)
      ? params.period as "all" | "this_month" | "last_30"
      : "all";
  const expired = params.expired === "1";
  const toRelance = params.toRelance === "1";
  const showArchived = params.archived === "1";
  const facturesOnly = params.facture_number === "not_null";

  const quotes = await getQuotes({
    q: search,
    status: statusFilter,
    period,
    expired: expired || undefined,
    toRelance: toRelance || undefined,
    archived: showArchived,
    facture_number: facturesOnly ? "not_null" : undefined,
  });

  const columns: DataTableColumn<typeof quotes[0]>[] = [
    {
      key: "reference",
      header: "Réf",
      render: (q) => (
        <span className="font-semibold text-primary">
          {q.reference ?? `#${q.id.slice(0, 8)}`}
        </span>
      ),
      sortable: true,
    },
    {
      key: "client",
      header: "Client",
      render: (q) => {
        const clientName =
          q.clients && typeof q.clients === "object" && "name" in q.clients
            ? (q.clients as { name: string | null }).name ?? "—"
            : "—";
        return <span className="text-muted-foreground">{clientName}</span>;
      },
    },
    {
      key: "vehicle",
      header: "Véhicule",
      render: (q) => {
        const v = q.vehicles;
        const vObj = v && typeof v === "object" && !Array.isArray(v)
          ? (v as { registration?: string | null; brand?: string | null; model?: string | null })
          : null;
        const vehicleLabel = vObj
          ? [vObj.registration, vObj.brand, vObj.model].filter(Boolean).join(" ") || "—"
          : "—";
        return <span className="text-muted-foreground">{vehicleLabel}</span>;
      },
    },
    {
      key: "status",
      header: "Statut",
      render: (q) => (
        <span className="flex items-center gap-1.5">
          <StatusBadge status={q.status} />
          {q.archived_at && <Badge variant="archived">Archivé</Badge>}
        </span>
      ),
    },
    {
      key: "dates",
      header: "Créé le / Validité",
      render: (q) => {
        const created = q.created_at ? new Date(q.created_at).toLocaleDateString("fr-FR") : "—";
        const valid = q.valid_until ? new Date(q.valid_until).toLocaleDateString("fr-FR") : "—";
        return (
          <span className="text-muted-foreground">
            {created}
            {valid !== "—" && ` / ${valid}`}
          </span>
        );
      },
    },
    {
      key: "amount",
      header: "Montant TTC",
      render: (q) => (
        <span className="tabular-nums font-semibold text-foreground">
          {Number(q.total_ttc ?? 0).toFixed(2)} €
        </span>
      ),
      className: "text-right",
    },
  ];

  const filters = (
    <>
      {showArchived && <input type="hidden" name="archived" value="1" />}
      {facturesOnly && <input type="hidden" name="facture_number" value="not_null" />}
      <select
        name="status"
        defaultValue={statusFilter ?? ""}
        className="h-9 rounded-input border border-border bg-background px-3 py-1 text-sm text-foreground focus-visible:ring-primary/40"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        name="period"
        defaultValue={period}
        className="h-9 rounded-input border border-border bg-background px-3 py-1 text-sm text-foreground focus-visible:ring-primary/40"
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="expired"
          value="1"
          defaultChecked={expired}
          className="rounded border-border"
        />
        Expirés
      </label>
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          name="toRelance"
          value="1"
          defaultChecked={toRelance}
          className="rounded border-border"
        />
        À relancer
      </label>
      <div className="flex rounded-button border border-border bg-muted/30 p-0.5">
        <Button variant={!showArchived ? "secondary" : "ghost"} size="sm" className="rounded-button" asChild>
          <Link href={buildDevisListUrl({ archived: false, params })}>Actifs</Link>
        </Button>
        <Button variant={showArchived ? "secondary" : "ghost"} size="sm" className="rounded-button" asChild>
          <Link href={buildDevisListUrl({ archived: true, params })}>Archivés</Link>
        </Button>
      </div>
      <Button type="submit" variant="outline" size="sm" className="rounded-button">
        Filtrer
      </Button>
    </>
  );

  const listLabel = facturesOnly ? "factures" : "devis";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {facturesOnly ? "Factures" : "Devis"}
        </h1>
        <div className="flex items-center gap-2">
          <ExportDevisDropdown
            filters={{
              q: search,
              status: statusFilter,
              period,
              expired: expired || undefined,
              toRelance: toRelance || undefined,
              archived: showArchived || undefined,
              facture_number: facturesOnly ? "not_null" : undefined,
            }}
          />
          {facturesOnly && <GenerateMissingFacturesButton />}
          <Button asChild size="sm" className="rounded-button bg-primary text-primary-foreground shadow-sm hover:shadow-md">
            <Link href="/dashboard/devis/new" className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouveau devis
            </Link>
          </Button>
        </div>
      </div>

      <form method="get" action="/dashboard/devis" className="hidden">
        {filters}
      </form>

      <DataTable
        title={`Liste des ${listLabel}`}
        columns={columns}
        data={quotes}
        searchPlaceholder="Réf., client, véhicule"
        searchValue={search}
        searchAction="/dashboard/devis"
        filters={
          <form method="get" action="/dashboard/devis" className="flex flex-wrap items-center gap-3">
            {filters}
          </form>
        }
        rowHref={(q) => `/dashboard/devis/${q.id}`}
        rowActions={(q) => (
          <>
            <DevisRowActions quoteId={q.id} />
            <EntityActionsMenu
              entityType="devis"
              entityId={q.id}
              isArchived={!!q.archived_at}
              listUrl="/dashboard/devis"
            />
          </>
        )}
        emptyState={{
          icon: <FileText className="h-6 w-6" />,
          title: showArchived
            ? search || statusFilter || period !== "all" || expired || toRelance
              ? (facturesOnly ? "Aucune facture archivée ne correspond aux filtres." : "Aucun devis archivé ne correspond aux filtres.")
              : (facturesOnly ? "Aucune facture archivée." : "Aucun devis archivé.")
            : search || statusFilter || period !== "all" || expired || toRelance
              ? (facturesOnly ? "Aucune facture ne correspond aux filtres." : "Aucun devis ne correspond aux filtres.")
              : (facturesOnly ? "Aucune facture." : "Aucun devis."),
          description: !showArchived && !search && !statusFilter && period === "all" && !expired && !toRelance
            ? (facturesOnly ? "Les factures apparaissent ici une fois les devis acceptés et numérotés." : "Crée ton premier devis.")
            : undefined,
          action: !showArchived && !search && !statusFilter && period === "all" && !expired && !toRelance && !facturesOnly
            ? { label: "Créer un devis", href: "/dashboard/devis/new" }
            : undefined,
        }}
        className="border-l-4 border-l-primary"
      />
    </div>
  );
}
