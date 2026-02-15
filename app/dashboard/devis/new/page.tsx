import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getClients } from "@/lib/actions/clients";
import { getVehicles } from "@/lib/actions/vehicles";
import { createQuoteAction } from "@/lib/actions/quotes";
import { DevisForm } from "./DevisForm";

export default async function NewDevisPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; vehicle_id?: string }>;
}) {
  const params = await searchParams;
  const [clients, vehicles] = await Promise.all([getClients(), getVehicles()]);
  const vehiclesForForm = vehicles.map((v) => ({
    id: v.id,
    registration: v.registration,
    brand: v.brand ?? null,
    model: v.model ?? null,
    client_id: v.client_id ?? undefined,
  }));
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/devis"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux devis
      </Link>
      <Card className="border-l-4 border-l-blue-600 border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Nouveau devis</CardTitle>
        </CardHeader>
        <CardContent>
          <DevisForm
            action={createQuoteAction}
            clients={clients}
            vehicles={vehiclesForForm}
            defaultClientId={params.client_id}
            defaultVehicleId={params.vehicle_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
