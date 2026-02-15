"use client";

import { useFormState } from "react-dom";
import { createFirstGarageAction, type CreateGarageResult } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm() {
  const [state, formAction] = useFormState(createFirstGarageAction, null as CreateGarageResult | null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nom du garage *</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Ex. Garage Martin"
          required
          className="w-full"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Adresse (optionnel)</Label>
        <Input
          id="address"
          name="address"
          type="text"
          placeholder="Ex. 10 rue de la République, 75001 Paris"
          className="w-full"
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="w-full">
        Créer mon garage
      </Button>
    </form>
  );
}
