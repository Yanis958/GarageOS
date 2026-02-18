"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createGarageFromInvitation } from "@/lib/actions/invitations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

type CreateGarageResult = { error?: string } | void;

export function InvitationSignupForm({
  invitationToken,
  garageName,
}: {
  invitationToken: string;
  garageName: string;
}) {
  const [state, formAction] = useFormState(
    async (_prev: CreateGarageResult, formData: FormData) => {
      return await createGarageFromInvitation(invitationToken, formData);
    },
    null as CreateGarageResult | null
  );

  return (
    <Card className="border-border shadow-sm">
      <CardContent className="pt-6">
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="votre@email.com"
              required
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe *</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Minimum 6 caractères"
              required
              minLength={6}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nom du garage *</Label>
            <Input
              id="name"
              name="name"
              type="text"
              defaultValue={garageName}
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
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{state.error}</p>
            </div>
          )}
          <Button type="submit" className="w-full bg-primary text-primary-foreground">
            Créer mon compte
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
