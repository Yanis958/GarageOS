"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { VehicleModal } from "./VehicleModal";
import { ConfirmDialog } from "@/components/archive-actions/ConfirmDialog";
import { Car, Plus, Edit2, Trash2, FileText } from "lucide-react";
import { createVehicleActionNoRedirect, updateVehicleAction, deleteVehicleAction, getVehiclesByClientId } from "@/lib/actions/vehicles";
import Link from "next/link";

type Vehicle = {
  id: string;
  registration: string | null;
  brand?: string | null;
  model?: string | null;
  vin?: string | null;
  year?: number | null;
  mileage?: number | null;
};

export function ClientVehiclesSection({
  clientId,
  vehicles: initialVehicles,
}: {
  clientId: string;
  vehicles: Vehicle[];
}) {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toujours charger la liste côté client au montage (même session que la création → pas de cache RSC)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVehiclesByClientId(clientId, false).then((list) => {
      if (!cancelled) {
        setVehicles(Array.isArray(list) ? list : []);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [clientId]);

  const handleCreateSuccess = async () => {
    setEditingVehicle(null);
    const list = await getVehiclesByClientId(clientId, false);
    setVehicles(Array.isArray(list) ? list : []);
    router.refresh();
  };

  const handleUpdateSuccess = async () => {
    setEditingVehicle(null);
    const list = await getVehiclesByClientId(clientId, false);
    setVehicles(Array.isArray(list) ? list : []);
    router.refresh();
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingVehicleId) return;
    setIsDeleting(true);
    const result = await deleteVehicleAction(deletingVehicleId);
    setIsDeleting(false);
    if (result.error) {
      toast.error(result.error);
      setDeleteDialogOpen(false);
      setDeletingVehicleId(null);
    } else {
      // Mettre à jour l'état local immédiatement pour un feedback instantané
      setVehicles(vehicles.filter((v) => v.id !== deletingVehicleId));
      toast.success("Véhicule supprimé avec succès");
      setDeleteDialogOpen(false);
      setDeletingVehicleId(null);
      // Recharger depuis le serveur pour synchroniser
      router.refresh();
    }
  };

  return (
    <>
      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Car className="h-5 w-5 text-primary" />
              Véhicules ({vehicles.length})
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingVehicle(null);
                setModalOpen(true);
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-1" />
              Ajouter un véhicule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading && vehicles.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Chargement des véhicules…
            </div>
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon={<Car className="h-6 w-6" />}
              title="Aucun véhicule"
              description="Ajoutez le premier véhicule pour ce client."
            />
          ) : (
            <div className="space-y-3">
              {vehicles.map((vehicle) => {
                const vehicleLabel = [vehicle.brand, vehicle.model]
                  .filter(Boolean)
                  .join(" ") || vehicle.registration || "Véhicule sans nom";

                return (
                  <div
                    key={vehicle.id}
                    className="flex items-start justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{vehicle.registration || "—"}</span>
                        {vehicle.brand || vehicle.model ? (
                          <span className="text-sm text-muted-foreground">
                            {vehicle.brand} {vehicle.model}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {vehicle.year && <span>Année : {vehicle.year}</span>}
                        {vehicle.mileage && <span>Kilométrage : {vehicle.mileage.toLocaleString()} km</span>}
                        {vehicle.vin && <span>VIN : {vehicle.vin}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        asChild
                        className="h-8 text-xs"
                      >
                        <Link href={`/dashboard/devis/new?client_id=${clientId}&vehicle_id=${vehicle.id}`}>
                          <FileText className="h-3 w-3 mr-1" />
                          Créer devis
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(vehicle)}
                        className="h-8 text-xs"
                      >
                        <Edit2 className="h-3 w-3 mr-1" />
                        Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeletingVehicleId(vehicle.id);
                          setDeleteDialogOpen(true);
                        }}
                        className="h-8 text-xs text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <VehicleModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditingVehicle(null);
        }}
        clientId={clientId}
        vehicle={editingVehicle}
        createAction={createVehicleActionNoRedirect}
        updateAction={updateVehicleAction}
        onSuccess={editingVehicle ? handleUpdateSuccess : handleCreateSuccess}
      />

      <ConfirmDialog
        variant="delete"
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </>
  );
}
