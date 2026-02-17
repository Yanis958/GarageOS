import Link from "next/link";
import { getClients } from "@/lib/actions/clients";
import { getVehicles } from "@/lib/actions/vehicles";
import { getQuotes } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EntityActionsMenu } from "@/components/archive-actions/EntityActionsMenu";
import { UserPlus, Users } from "lucide-react";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q, archived } = await searchParams;
  const search = typeof q === "string" ? q : undefined;
  const showArchived = archived === "1";
  const [clients, vehiclesList, allQuotes] = await Promise.all([
    getClients(search, showArchived),
    getVehicles(undefined, false),
    getQuotes({ status: "accepted" }),
  ]);

  const vehiclesByClientId = new Map<string, { registration: string | null; brand?: string | null; model?: string | null }[]>();
  for (const v of vehiclesList) {
    const cid = v.client_id ?? "";
    if (!cid) continue;
    if (!vehiclesByClientId.has(cid)) vehiclesByClientId.set(cid, []);
    vehiclesByClientId.get(cid)!.push({
      registration: v.registration ?? null,
      brand: v.brand ?? null,
      model: v.model ?? null,
    });
  }

  // Calculer le CA total par client (somme des factures acceptées)
  const caByClientId = new Map<string, number>();
  for (const quote of allQuotes) {
    if (quote.status === "accepted" && quote.client_id) {
      const currentCA = caByClientId.get(quote.client_id) ?? 0;
      caByClientId.set(quote.client_id, currentCA + Number(quote.total_ttc ?? 0));
    }
  }

  const columns: DataTableColumn<(typeof clients)[0]>[] = [
    {
      key: "name",
      header: "Nom",
      render: (c) => <span className="font-semibold text-foreground">{c.name}</span>,
      sortable: true,
    },
    {
      key: "contact",
      header: "Contact",
      render: (c) => (
        <span className="text-muted-foreground">
          {[c.phone, c.email].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "vehicles",
      header: "Véhicule(s)",
      render: (c) => {
        const vehicles = vehiclesByClientId.get(c.id) ?? [];
        if (vehicles.length === 0) return <span className="text-muted-foreground">—</span>;
        const first = vehicles[0];
        const plaque = first.registration || "—";
        const marqueModele = [first.brand, first.model].filter(Boolean).join(" ") || "—";
        const extra = vehicles.length > 1 ? ` (+${vehicles.length - 1})` : "";
        return (
          <span className="text-muted-foreground" title={vehicles.length > 1 ? vehicles.map((v) => `${v.registration ?? "—"} · ${[v.brand, v.model].filter(Boolean).join(" ")}`).join("\n") : undefined}>
            {plaque} · {marqueModele}{extra}
          </span>
        );
      },
    },
    {
      key: "ca_total",
      header: "CA Total",
      render: (c) => {
        const ca = caByClientId.get(c.id) ?? 0;
        return (
          <span className={ca > 0 ? "font-medium text-foreground tabular-nums" : "text-muted-foreground tabular-nums"}>
            {ca.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € TTC
          </span>
        );
      },
      sortable: true,
    },
    {
      key: "status",
      header: "Statut",
      render: (c) => (
        <span className="flex items-center gap-1.5">
          {c.archived_at && <Badge variant="archived">Archivé</Badge>}
        </span>
      ),
    },
  ];

  const filters = (
    <>
      {showArchived && <input type="hidden" name="archived" value="1" />}
      <div className="flex rounded-button border border-border bg-muted/30 p-0.5">
        <Button variant={!showArchived ? "secondary" : "ghost"} size="sm" className="rounded-button" asChild>
          <Link href={search ? `/dashboard/clients?q=${encodeURIComponent(search)}` : "/dashboard/clients"}>Actifs</Link>
        </Button>
        <Button variant={showArchived ? "secondary" : "ghost"} size="sm" className="rounded-button" asChild>
          <Link href={search ? `/dashboard/clients?archived=1&q=${encodeURIComponent(search)}` : "/dashboard/clients?archived=1"}>Archivés</Link>
        </Button>
      </div>
      <Button type="submit" variant="outline" size="sm" className="rounded-button">
        Rechercher
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Clients
        </h1>
        <div className="flex items-center gap-2">
          <ExportButton endpoint="/api/export/clients" filename="clients_{date}.csv" />
          <Button asChild size="sm" className="rounded-button bg-primary text-primary-foreground shadow-sm hover:shadow-md">
            <Link href="/dashboard/clients/new" className="inline-flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Nouveau client
            </Link>
          </Button>
        </div>
      </div>

      <DataTable
        title="Liste des clients"
        columns={columns}
        data={clients}
        searchPlaceholder="Rechercher (nom, tél, email)"
        searchValue={search}
        searchAction="/dashboard/clients"
        filters={
          <form method="get" action="/dashboard/clients" className="flex flex-wrap items-center gap-3">
            {filters}
          </form>
        }
        rowHref={(c) => `/dashboard/clients/${c.id}`}
        rowActions={(c) => (
          <EntityActionsMenu
            entityType="client"
            entityId={c.id}
            isArchived={!!c.archived_at}
            listUrl="/dashboard/clients"
            redirectToListAfterDelete
          />
        )}
        emptyState={{
          icon: <Users className="h-6 w-6" />,
          title: showArchived
            ? search
              ? "Aucun client archivé ne correspond à la recherche."
              : "Aucun client archivé."
            : search
              ? "Aucun client ne correspond à la recherche."
              : "Aucun client pour l'instant.",
          description: !showArchived && !search ? "Ajoute ton premier client pour créer des devis." : undefined,
          action: !showArchived && !search ? { label: "Ajouter un client", href: "/dashboard/clients/new" } : undefined,
        }}
        className="border-l-4 border-l-primary"
      />
    </div>
  );
}
