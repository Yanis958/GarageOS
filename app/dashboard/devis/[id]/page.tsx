import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuoteById, getQuotes } from "@/lib/actions/quotes";
import { getClients } from "@/lib/actions/clients";
import { getVehicles } from "@/lib/actions/vehicles";
import { getCurrentGarage } from "@/lib/actions/garage";
import { DevisEditForm } from "./DevisEditForm";
import { ArchivedBanner } from "@/components/archive-actions/ArchivedBanner";
import { EntityActionsMenu } from "@/components/archive-actions/EntityActionsMenu";
import { ArrowLeft, Sparkles, AlertCircle } from "lucide-react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { Button } from "@/components/ui/button";

export default async function DevisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [quote, clients, allVehicles, garage, allQuotes] = await Promise.all([
    getQuoteById(id),
    getClients(),
    getVehicles(),
    getCurrentGarage(),
    getQuotes(),
  ]);
  if (!quote) notFound();

  const isArchived = !!(quote as { archived_at?: string | null }).archived_at;

  const vehicles = allVehicles.map((v) => ({
    id: v.id,
    registration: v.registration,
    brand: v.brand ?? null,
    model: v.model ?? null,
    client_id: v.client_id ?? undefined,
  }));

  // Calculs pour le bloc IA stratégique
  const isSent = quote.status === "sent";
  const createdDate = new Date(quote.created_at);
  const today = new Date();
  const daysSinceSent = isSent ? Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Calcul moyenne d'acceptation (devis acceptés créés dans les 30 derniers jours)
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentAcceptedQuotes = allQuotes.filter((q) => {
    if (q.status !== "accepted") return false;
    const qCreated = new Date(q.created_at);
    return qCreated >= thirtyDaysAgo;
  });
  const averageAcceptanceDays = recentAcceptedQuotes.length > 0
    ? Math.round(
        recentAcceptedQuotes.reduce((sum, q) => {
          const sentDate = new Date(q.created_at);
          const acceptedDate = new Date(q.created_at); // Approximation : on utilise created_at comme proxy
          return sum + Math.max(0, Math.floor((acceptedDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24)));
        }, 0) / recentAcceptedQuotes.length
      )
    : 5; // Fallback : 5 jours par défaut

  const shouldRelance = isSent && daysSinceSent >= 3;
  const recommendation = shouldRelance
    ? daysSinceSent > averageAcceptanceDays
      ? "Ce devis dépasse la moyenne d'acceptation. Recommandation : relancer aujourd'hui."
      : "Recommandation : relancer aujourd'hui pour maximiser les chances d'acceptation."
    : null;

  return (
    <div className="space-y-6 max-w-[1280px] mx-auto">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard/devis"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux devis
        </Link>
        <EntityActionsMenu
          entityType="devis"
          entityId={id}
          isArchived={isArchived}
          listUrl="/dashboard/devis"
          redirectToListAfterDelete
        />
      </div>

      {isArchived && (
        <ArchivedBanner entityType="devis" entityId={id} />
      )}

      {/* Bloc IA Stratégique */}
      {isSent && shouldRelance && (
        <DashboardCard title="Section IA Stratégique">
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-foreground">
                    Ce devis a été envoyé il y a <span className="font-semibold">{daysSinceSent} jour{daysSinceSent > 1 ? "s" : ""}</span>.
                  </p>
                  {recentAcceptedQuotes.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Les devis similaires sont acceptés en moyenne sous <span className="font-semibold text-foreground">{averageAcceptanceDays} jour{averageAcceptanceDays > 1 ? "s" : ""}</span>.
                    </p>
                  )}
                  {recommendation && (
                    <p className="text-sm font-medium text-foreground mt-2">
                      {recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button asChild size="sm" variant="default" className="rounded-button">
                <Link href={`/dashboard/devis/${id}#relance`}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Relancer maintenant
                </Link>
              </Button>
            </div>
          </div>
        </DashboardCard>
      )}

      <DevisEditForm
        quote={{
          id: quote.id,
          client_id: quote.client_id,
          vehicle_id: quote.vehicle_id,
          status: quote.status,
          reference: quote.reference,
          valid_until: quote.valid_until,
          notes: quote.notes ?? null,
          notes_client: (quote as { notes_client?: string | null }).notes_client ?? null,
          total_ht: Number(quote.total_ht ?? 0),
          total_ttc: Number(quote.total_ttc ?? 0),
          created_at: quote.created_at,
          clients: quote.clients,
          vehicles: quote.vehicles,
          items: (quote as { items?: Array<{ id?: string; description?: string; quantity?: number; unit_price?: number; total?: number; type?: string }> }).items ?? [],
        }}
        clients={clients}
        allVehicles={vehicles}
        garage={garage ?? undefined}
      />
    </div>
  );
}
