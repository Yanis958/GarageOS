import Link from "next/link";
import { redirect } from "next/navigation";
import { getVehicleById } from "@/lib/actions/vehicles";
import { getQuotesByVehicleId, getQuotes } from "@/lib/actions/quotes";
import { getQuickTasksByEntity } from "@/lib/actions/quick-tasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ArchivedBanner } from "@/components/archive-actions/ArchivedBanner";
import { EntityActionsMenu } from "@/components/archive-actions/EntityActionsMenu";
import { VehicleCreatedToast } from "./VehicleCreatedToast";
import { Car, FileText, ArrowLeft, PlusCircle } from "lucide-react";
import { QuickNoteBlock } from "@/components/dashboard/QuickNoteBlock";
import { generateReadableReferences, getReadableReference } from "@/lib/utils/quote-reference";

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const vehicle = await getVehicleById(id);
  if (!vehicle) redirect("/dashboard/vehicles");

  const [quotes, quickTasks, allQuotes] = await Promise.all([
    getQuotesByVehicleId(id),
    getQuickTasksByEntity("vehicle", id),
    getQuotes(),
  ]);
  const clientName =
    vehicle.clients && typeof vehicle.clients === "object" && "name" in vehicle.clients
      ? (vehicle.clients as { name: string | null }).name
      : null;
  const isArchived = !!(vehicle as { archived_at?: string | null }).archived_at;

  // Générer les références lisibles pour toutes les quotes
  const sortedAllQuotes = [...allQuotes].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const readableReferences = generateReadableReferences(sortedAllQuotes);

  return (
    <div className="space-y-6">
      <VehicleCreatedToast show={created === "1"} />
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux véhicules
      </Link>

      {isArchived && (
        <ArchivedBanner entityType="vehicle" entityId={id} />
      )}

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Car className="h-5 w-5 text-primary" />
              Fiche véhicule
            </CardTitle>
            <EntityActionsMenu
              entityType="vehicle"
              entityId={id}
              isArchived={isArchived}
              listUrl="/dashboard/vehicles"
              redirectToListAfterDelete
              hideHardDelete
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p><strong className="text-foreground">Immat. :</strong> {vehicle.registration}</p>
          {vehicle.brand && <p><strong className="text-foreground">Marque :</strong> {vehicle.brand}</p>}
          {vehicle.model && <p><strong className="text-foreground">Modèle :</strong> {vehicle.model}</p>}
          {vehicle.year && <p><strong className="text-foreground">Année :</strong> {vehicle.year}</p>}
          {(vehicle as { mileage?: number | null }).mileage && (
            <p><strong className="text-foreground">Kilomètres :</strong> {((vehicle as { mileage?: number | null }).mileage ?? 0).toLocaleString("fr-FR")} km</p>
          )}
          {clientName && (
            <p>
              <strong className="text-foreground">Client :</strong>{" "}
              <Link href={`/dashboard/clients/${vehicle.client_id}`} className="text-primary hover:underline">
                {clientName}
              </Link>
            </p>
          )}
          {vehicle.notes && <p><strong className="text-foreground">Notes :</strong> {vehicle.notes}</p>}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Note rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickNoteBlock
            entityType="vehicle"
            entityId={id}
            clientId={vehicle.client_id}
            vehicleId={id}
            tasks={quickTasks}
          />
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-foreground">Créer un devis pour ce véhicule</p>
          <Button asChild size="sm" className="mt-4 bg-primary hover:bg-primary/90 text-white">
            <Link
              href={`/dashboard/devis/new?client_id=${vehicle.client_id}&vehicle_id=${id}`}
              className="inline-flex items-center gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Créer un devis pour ce véhicule
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Historique devis ({quotes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Aucun devis pour ce véhicule"
              action={{
                label: "Créer un devis pour ce véhicule",
                href: `/dashboard/devis/new?client_id=${vehicle.client_id}&vehicle_id=${id}`,
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Référence</th>
                    <th className="pb-2 font-medium">Statut</th>
                    <th className="pb-2 font-medium text-right">Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td className="py-2">
                        <Link href={`/dashboard/devis/${q.id}`} className="font-medium text-foreground hover:underline">
                          {getReadableReference(q.id, readableReferences, q.reference)}
                        </Link>
                      </td>
                      <td className="py-2">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="py-2 text-right tabular-nums">{Number(q.total_ttc ?? 0).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
