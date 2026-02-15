import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { getClients } from "@/lib/actions/clients";
import { VehicleForm } from "./VehicleForm";
import { createVehicleAction } from "@/lib/actions/vehicles";

export default async function NewVehiclePage() {
  const clients = await getClients();
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/vehicles"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux véhicules
      </Link>
      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Nouveau véhicule</CardTitle>
        </CardHeader>
        <CardContent>
          <VehicleForm action={createVehicleAction} clients={clients} />
        </CardContent>
      </Card>
    </div>
  );
}
