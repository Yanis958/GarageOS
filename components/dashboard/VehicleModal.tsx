"use client";

import { useEffect, useState, useRef } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createVehicleActionNoRedirect } from "@/lib/actions/vehicles";

type ActionResult = { error?: string; vehicleId?: string } | void;

type Vehicle = {
  id?: string;
  registration: string | null;
  brand?: string | null;
  model?: string | null;
  vin?: string | null;
  year?: number | null;
  mileage?: number | null;
};

/** Normalise au format français AB-123-CD (côté client pour affichage). */
function formatRegistrationClient(value: string): string {
  const clean = value.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length === 7 && /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

export function VehicleModal({
  open,
  onOpenChange,
  clientId,
  vehicle,
  createAction,
  updateAction,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  vehicle?: Vehicle | null;
  createAction?: (prev: unknown, formData: FormData) => Promise<ActionResult>;
  updateAction: (prev: unknown, formData: FormData) => Promise<ActionResult>;
  onSuccess?: (vehicleId: string) => void;
}) {
  const isEdit = !!vehicle?.id;
  const action = isEdit ? updateAction : (createAction || createVehicleActionNoRedirect);
  const [state, formAction] = useFormState(action, undefined as ActionResult);
  const [registration, setRegistration] = useState(vehicle?.registration || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const processedStateRef = useRef<string | null>(null);

  useEffect(() => {
    if (vehicle) {
      setRegistration(vehicle.registration || "");
    } else {
      setRegistration("");
    }
  }, [vehicle, open]);

  // Réinitialiser le ref quand le modal s'ouvre
  useEffect(() => {
    if (open) {
      processedStateRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    // Ne rien faire si pas d'état ou si déjà traité
    if (!state) return;
    
    // Créer une clé unique pour cet état basée sur le contenu réel
    const stateKey = state.error 
      ? `error-${state.error}` 
      : state.vehicleId 
        ? `success-${state.vehicleId}` 
        : "success-no-id";
    
    // Si on a déjà traité cet état exact, ne rien faire
    if (processedStateRef.current === stateKey) {
      return;
    }

    // Marquer comme traité IMMÉDIATEMENT pour éviter les doubles traitements
    processedStateRef.current = stateKey;

    // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
    requestAnimationFrame(() => {
      if (state.error) {
        toast.error(state.error);
        setIsSubmitting(false);
      } else {
        // Succès
        setIsSubmitting(false);
        toast.success(isEdit ? "Véhicule modifié avec succès" : "Véhicule créé avec succès");
        
        // Fermer le modal
        onOpenChange(false);
        
        // Appeler onSuccess si fourni (il gérera le refresh)
        if (onSuccess) {
          if (state.vehicleId) {
            // Appeler avec un petit délai pour laisser le modal se fermer
            setTimeout(() => {
              onSuccess(state.vehicleId);
            }, 100);
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]); // Seulement dépendre de state, pas des autres props qui changent

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    formData.append("client_id", clientId);
    if (isEdit && vehicle?.id) {
      formData.append("vehicle_id", vehicle.id);
    }
    await formAction(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le véhicule" : "Ajouter un véhicule"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifiez les informations du véhicule." : "Ajoutez un nouveau véhicule pour ce client."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="registration">Immatriculation *</Label>
            <Input
              id="registration"
              name="registration"
              placeholder="AB-123-CD"
              value={registration}
              onChange={(e) => setRegistration(e.target.value.replace(/[^A-Za-z0-9-]/g, "").toUpperCase())}
              onBlur={() => setRegistration((v) => formatRegistrationClient(v))}
              maxLength={9}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand">Marque *</Label>
            <Input
              id="brand"
              name="brand"
              placeholder="Peugeot, Renault..."
              defaultValue={vehicle?.brand || ""}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Modèle *</Label>
            <Input
              id="model"
              name="model"
              placeholder="308, Clio..."
              defaultValue={vehicle?.model || ""}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Année</Label>
              <Input
                id="year"
                name="year"
                type="number"
                min="1900"
                max="2100"
                placeholder="2020"
                defaultValue={vehicle?.year || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mileage">Kilométrage</Label>
              <Input
                id="mileage"
                name="mileage"
                type="number"
                min="0"
                placeholder="50000"
                defaultValue={vehicle?.mileage || ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vin">VIN (optionnel)</Label>
            <Input
              id="vin"
              name="vin"
              placeholder="Numéro VIN"
              defaultValue={vehicle?.vin || ""}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "..." : isEdit ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
