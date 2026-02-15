"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Car, AlertCircle, Plus } from "lucide-react";
import { VehicleModal } from "@/components/dashboard/VehicleModal";
import { createVehicleActionNoRedirect, updateVehicleAction } from "@/lib/actions/vehicles";

type ActionResult = { error?: string } | void;
type Client = { id: string; name: string | null };
type Vehicle = {
  id: string;
  registration: string | null;
  brand?: string | null;
  model?: string | null;
  client_id?: string;
};

export function DevisForm({
  action,
  clients,
  vehicles: initialVehicles,
  defaultClientId,
  defaultVehicleId,
}: {
  action: (prev: unknown, formData: FormData) => Promise<ActionResult>;
  clients: Client[];
  vehicles: Vehicle[];
  defaultClientId?: string;
  defaultVehicleId?: string;
}) {
  const [state, formAction] = useFormState(action, undefined as ActionResult);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  // Utiliser defaultClientId directement pour éviter les différences d'hydratation
  const [selectedClientId, setSelectedClientId] = useState<string>(() => defaultClientId || "");
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    // Initialiser avec les véhicules filtrés si defaultClientId existe
    if (defaultClientId) {
      return initialVehicles.filter((v) => v.client_id === defaultClientId);
    }
    return initialVehicles;
  });
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => defaultVehicleId || "");

  // Éviter les erreurs d'hydratation en ne rendant le contenu dynamique qu'après le montage
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (state?.error) toast.error(state.error);
  }, [state?.error, mounted]);

  // Filtrer les véhicules par client sélectionné (seulement après montage pour éviter les erreurs d'hydratation)
  useEffect(() => {
    if (!mounted) return;
    if (selectedClientId) {
      // Filtrer les véhicules du client sélectionné
      const filtered = initialVehicles.filter((v) => v.client_id === selectedClientId);
      setVehicles(filtered);
    } else {
      setVehicles(initialVehicles);
    }
  }, [selectedClientId, initialVehicles, mounted]);
  
  // Initialiser vehicles avec les valeurs par défaut au premier rendu
  useEffect(() => {
    if (defaultClientId && !mounted) {
      const filtered = initialVehicles.filter((v) => v.client_id === defaultClientId);
      setVehicles(filtered);
    }
  }, [defaultClientId, initialVehicles, mounted]);

  const handleVehicleCreated = (vehicleId: string) => {
    // Sélectionner le nouveau véhicule
    setSelectedVehicleId(vehicleId);
    // Le modal se ferme déjà dans VehicleModal
    // Recharger une seule fois pour avoir les nouveaux véhicules
    setTimeout(() => {
      router.refresh();
    }, 300);
  };

  const hasClients = clients.length > 0;
  // Utiliser defaultClientId pour le calcul initial (cohérent entre serveur et client)
  // puis selectedClientId après le montage pour les changements dynamiques
  const currentClientId = mounted ? selectedClientId : (defaultClientId || "");
  const clientVehicles = currentClientId 
    ? initialVehicles.filter((v) => v.client_id === currentClientId)
    : initialVehicles;
  const hasVehicles = clientVehicles.length > 0;

  return (
    <>
    <form action={formAction} className="space-y-4 max-w-md">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      
      {/* Champ Client */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="client_id">Client *</Label>
          <Link href="/dashboard/clients/new">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Nouveau client
            </Button>
          </Link>
        </div>
        <div className="space-y-1">
          <select
            id="client_id"
            name="client_id"
            required
            defaultValue={defaultClientId}
            onChange={(e) => {
              setSelectedClientId(e.target.value);
              setSelectedVehicleId("");
            }}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
          >
            <option value="">Choisir un client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? "—"}
              </option>
            ))}
          </select>
          {!hasClients && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Aucun client disponible.{" "}
              <Link href="/dashboard/clients/new" className="text-primary hover:underline">
                Créer le premier client
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Champ Véhicule */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="vehicle_id">Véhicule</Label>
          {mounted && selectedClientId && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setVehicleModalOpen(true)}
              className="h-7 text-xs text-primary hover:text-primary"
            >
              <Plus className="h-3 w-3 mr-1" />
              Ajouter un véhicule
            </Button>
          )}
          {mounted && !selectedClientId && (
            <Link href="/dashboard/vehicles/new">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-primary hover:text-primary"
              >
                <Car className="h-3 w-3 mr-1" />
                Nouveau véhicule
              </Button>
            </Link>
          )}
        </div>
        <div className="space-y-1">
          <select
            id="vehicle_id"
            name="vehicle_id"
            defaultValue={defaultVehicleId || ""}
            onChange={(e) => setSelectedVehicleId(e.target.value)}
            disabled={!currentClientId}
            className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Aucun (à préciser plus tard)</option>
            {/* Toujours rendre les options pour éviter les différences d'hydratation */}
            {clientVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.registration} {v.brand || ""} {v.model || ""}
              </option>
            ))}
          </select>
          {!currentClientId && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Sélectionnez d'abord un client pour voir ses véhicules
            </p>
          )}
          {currentClientId && !hasVehicles && mounted && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertCircle className="h-3 w-3" />
              Aucun véhicule pour ce client.{" "}
              <button
                type="button"
                onClick={() => setVehicleModalOpen(true)}
                className="text-primary hover:underline"
              >
                Ajouter un véhicule
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Champ Référence */}
      <div className="space-y-2">
        <Label htmlFor="reference">Référence</Label>
        <Input id="reference" name="reference" placeholder="Ex. 2026-003 (optionnel)" />
      </div>

      {/* Boutons d'action */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700">
          Créer le devis (brouillon)
        </Button>
        <Button type="reset" variant="outline" size="sm">
          Réinitialiser
        </Button>
      </div>
    </form>

    {mounted && selectedClientId && (
      <VehicleModal
        open={vehicleModalOpen}
        onOpenChange={setVehicleModalOpen}
        clientId={selectedClientId}
        vehicle={null}
        createAction={createVehicleActionNoRedirect}
        updateAction={updateVehicleAction}
        onSuccess={handleVehicleCreated}
      />
    )}
  </>
  );
}
