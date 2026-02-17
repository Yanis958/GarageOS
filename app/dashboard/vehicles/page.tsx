import Link from "next/link";
import { getVehicles } from "@/lib/actions/vehicles";
import { getQuotes } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EntityActionsMenu } from "@/components/archive-actions/EntityActionsMenu";
import { Car } from "lucide-react";
import { ExportButton } from "@/components/dashboard/ExportButton";
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; archived?: string }>;
}) {
  const { q, archived } = await searchParams;
  const search = typeof q === "string" ? q : undefined;
  const showArchived = archived === "1";
  const [vehicles, allQuotes] = await Promise.all([
    getVehicles(search, showArchived),
    getQuotes({ status: "accepted" }),
  ]);

  // Créer un Map pour la dernière intervention par véhicule (date du dernier devis accepté)
  const lastInterventionByVehicleId = new Map<string, Date>();
  for (const quote of allQuotes) {
    if (quote.status === "accepted" && quote.vehicle_id) {
      const existingDate = lastInterventionByVehicleId.get(quote.vehicle_id);
      const quoteDate = new Date(quote.created_at);
      if (!existingDate || quoteDate > existingDate) {
        lastInterventionByVehicleId.set(quote.vehicle_id, quoteDate);
      }
    }
  }

  // Fonction pour formater la date de dernière intervention
  const formatLastIntervention = (vehicleId: string): string => {
    const date = lastInterventionByVehicleId.get(vehicleId);
    if (!date) return <span className="text-muted-foreground">Aucune</span>;
    const today = new Date();
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    
    return date.toLocaleDateString("fr-FR");
  };

  const columns: DataTableColumn<typeof vehicles[0]>[] = [
    {
      key: "registration",
      header: "Immatriculation",
      render: (v) => <span className="font-semibold text-foreground">{v.registration}</span>,
      sortable: true,
    },
    {
      key: "details",
      header: "Marque / Modèle",
      render: (v) => (
        <span className="text-muted-foreground">
          {[v.brand, v.model].filter(Boolean).join(" ") || "—"}
        </span>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (v) => {
        // Essayer d'abord via la relation clients
        let clientName: string | null = null;
        if (v.clients && typeof v.clients === "object" && "name" in v.clients) {
          clientName = (v.clients as { name: string | null }).name;
        }
        
        // Si pas de nom via relation mais qu'on a un client_id, afficher un lien
        if (!clientName && v.client_id) {
          return (
            <Link 
              href={`/dashboard/clients/${v.client_id}`}
              className="text-primary hover:underline text-muted-foreground"
            >
              Voir client
            </Link>
          );
        }
        
        return <span className="text-muted-foreground">{clientName ?? "—"}</span>;
      },
    },
    {
      key: "last_intervention",
      header: "Dernière intervention",
      render: (v) => {
        const intervention = formatLastIntervention(v.id);
        return typeof intervention === "string" ? (
          <span className="text-muted-foreground">{intervention}</span>
        ) : (
          intervention
        );
      },
    },
    {
      key: "mileage",
      header: "Kilométrage",
      render: (v) => {
        const mileage = (v as { mileage?: number | null }).mileage;
        if (!mileage) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="text-muted-foreground tabular-nums">
            {mileage.toLocaleString("fr-FR")} km
          </span>
        );
      },
    },
  ];

  const filters = (
    <>
      {showArchived && <input type="hidden" name="archived" value="1" />}
      <div className="flex rounded-button border border-border bg-muted/30 p-0.5">
        <Button variant={!showArchived ? "secondary" : "ghost"} size="sm" className="rounded-button" asChild>
          <Link href={search ? `/dashboard/vehicles?q=${encodeURIComponent(search)}` : "/dashboard/vehicles"}>Actifs</Link>
        </Button>
        <Button variant={showArchived ? "secondary" : "ghost"} size="sm" className="rounded-button" asChild>
          <Link href={search ? `/dashboard/vehicles?archived=1&q=${encodeURIComponent(search)}` : "/dashboard/vehicles?archived=1"}>Archivés</Link>
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
          Véhicules
        </h1>
        <div className="flex items-center gap-2">
          <ExportButton endpoint="/api/export/vehicles" filename="vehicules_{date}.csv" />
          <Button asChild size="sm" className="rounded-button bg-primary text-primary-foreground shadow-sm hover:shadow-md">
            <Link href="/dashboard/vehicles/new" className="inline-flex items-center gap-2">
              <Car className="h-4 w-4" />
              Nouveau véhicule
            </Link>
          </Button>
        </div>
      </div>

      <DataTable
        title="Liste des véhicules"
        columns={columns}
        data={vehicles}
        searchPlaceholder="Rechercher (immat., marque, client)"
        searchValue={search}
        searchAction="/dashboard/vehicles"
        filters={
          <form method="get" action="/dashboard/vehicles" className="flex flex-wrap items-center gap-3">
            {filters}
          </form>
        }
        rowHref={(v) => `/dashboard/vehicles/${v.id}`}
        rowActions={(v) => (
          <EntityActionsMenu
            entityType="vehicle"
            entityId={v.id}
            isArchived={!!v.archived_at}
            listUrl="/dashboard/vehicles"
            hideHardDelete
          />
        )}
        emptyState={{
          icon: <Car className="h-6 w-6" />,
          title: showArchived
            ? search
              ? "Aucun véhicule archivé ne correspond à la recherche."
              : "Aucun véhicule archivé."
            : search
              ? "Aucun véhicule ne correspond à la recherche."
              : "Aucun véhicule.",
          description: !showArchived && !search ? "Ajoute un véhicule (lié à un client) pour créer des devis." : undefined,
          action: !showArchived && !search ? { label: "Ajouter un véhicule", href: "/dashboard/vehicles/new" } : undefined,
        }}
        className="border-l-4 border-l-primary"
      />
    </div>
  );
}
