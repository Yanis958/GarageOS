import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientById } from "@/lib/actions/clients";
import { getQuotesByClientId } from "@/lib/actions/quotes";
import { getQuickTasksByEntity } from "@/lib/actions/quick-tasks";
import { getVehiclesByClientId } from "@/lib/actions/vehicles";
import { ClientVehiclesSection } from "@/components/dashboard/ClientVehiclesSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ArchivedBanner } from "@/components/archive-actions/ArchivedBanner";
import { EntityActionsMenu } from "@/components/archive-actions/EntityActionsMenu";
import { ArrowLeft, User, FileText, PlusCircle } from "lucide-react";
import { ClientMessageBlock } from "@/components/dashboard/ClientMessageBlock";
import { QuickNoteBlock } from "@/components/dashboard/QuickNoteBlock";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) redirect("/dashboard/clients");

  const [quotes, quickTasks, vehicles] = await Promise.all([
    getQuotesByClientId(id),
    getQuickTasksByEntity("client", id),
    getVehiclesByClientId(id, false),
  ]);
  const totalCA = quotes
    .filter((q) => q.status === "accepted")
    .reduce((sum, q) => sum + Number(q.total_ttc ?? 0), 0);
  const lastQuote = quotes[0] ?? null;
  const statusLabels: Record<string, string> = {
    draft: "Brouillon",
    sent: "Envoyé",
    accepted: "Accepté",
    declined: "Refusé",
    expired: "Expiré",
  };

  const isArchived = !!(client as { archived_at?: string | null }).archived_at;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>

      {isArchived && (
        <ArchivedBanner entityType="client" entityId={id} />
      )}

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <User className="h-5 w-5 text-primary" />
              {client.name}
            </CardTitle>
            <EntityActionsMenu
              entityType="client"
              entityId={id}
              isArchived={isArchived}
              listUrl="/dashboard/clients"
              redirectToListAfterDelete
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {client.phone && <p><strong className="text-foreground">Tél :</strong> {client.phone}</p>}
          {client.email && <p><strong className="text-foreground">Email :</strong> {client.email}</p>}
          {client.notes && <p><strong className="text-foreground">Notes :</strong> {client.notes}</p>}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">CA total (acceptés)</p>
            <p className="mt-1 text-xl font-bold text-foreground">{totalCA.toFixed(2)} €</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">Nombre de devis</p>
            <p className="mt-1 text-xl font-bold text-foreground">{quotes.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">Dernier devis</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {lastQuote ? (lastQuote.reference ?? `#${lastQuote.id.slice(0, 8)}`) : "—"}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">Statut dernier</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {lastQuote ? (statusLabels[lastQuote.status] ?? lastQuote.status) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <ClientVehiclesSection clientId={id} vehicles={vehicles} />

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-foreground">Créer un devis pour ce client</p>
          <Button asChild size="sm" className="mt-4 bg-primary hover:bg-primary/90 text-white">
            <Link href={`/dashboard/devis/new?client_id=${id}`} className="inline-flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Créer un devis
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Note rapide</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickNoteBlock
            entityType="client"
            entityId={id}
            clientId={id}
            vehicleId={null}
            tasks={quickTasks}
          />
        </CardContent>
      </Card>

      <ClientMessageBlock
        client={{ name: client.name, email: client.email, phone: client.phone }}
        lastQuote={lastQuote ? { reference: lastQuote.reference, total_ttc: lastQuote.total_ttc, valid_until: lastQuote.valid_until, vehicles: lastQuote.vehicles } : null}
      />

      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Derniers devis ({quotes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Aucun devis pour ce client"
              action={{ label: "Créer un devis", href: `/dashboard/devis/new?client_id=${id}` }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Référence</th>
                    <th className="pb-2 font-medium">Véhicule</th>
                    <th className="pb-2 font-medium">Statut</th>
                    <th className="pb-2 font-medium text-right">Total TTC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {quotes.map((q) => (
                    <tr key={q.id}>
                      <td className="py-2">
                        <Link href={`/dashboard/devis/${q.id}`} className="font-medium text-foreground hover:underline">
                          {q.reference ?? `#${q.id.slice(0, 8)}`}
                        </Link>
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {q.vehicles && typeof q.vehicles === "object" && "registration" in q.vehicles
                          ? (q.vehicles as { registration: string | null }).registration ?? "—"
                          : "—"}
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
