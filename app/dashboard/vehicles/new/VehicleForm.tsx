"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ActionResult = { error?: string } | void;
type Client = { id: string; name: string | null };

/** Normalise au format français AB-123-CD (côté client pour affichage). */
function formatRegistrationClient(value: string): string {
  const clean = value.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length === 7 && /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

export function VehicleForm({
  action,
  clients,
}: {
  action: (prev: unknown, formData: FormData) => Promise<ActionResult>;
  clients: Client[];
}) {
  const [state, formAction] = useFormState(action, undefined as ActionResult);
  const [registration, setRegistration] = useState("");

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state?.error]);

  return (
    <form action={formAction} className="space-y-4 max-w-md">
      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="client_id">Client *</Label>
        <select
          id="client_id"
          name="client_id"
          required
          className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm"
        >
          <option value="">Choisir un client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? "—"}
            </option>
          ))}
        </select>
      </div>
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
        <Label htmlFor="brand">Marque</Label>
        <Input id="brand" name="brand" placeholder="Peugeot, Renault..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="model">Modèle</Label>
        <Input id="model" name="model" placeholder="308, Clio..." />
      </div>
      <div className="space-y-2">
        <Label htmlFor="year">Année</Label>
        <Input id="year" name="year" type="number" min="1900" max="2100" placeholder="2020" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" placeholder="Notes" />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90">
          Créer le véhicule
        </Button>
        <Button type="reset" variant="outline" size="sm">
          Réinitialiser
        </Button>
      </div>
    </form>
  );
}
