"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { updateGarageSettingsAction } from "@/lib/actions/garage";
import type { GarageSettings } from "@/lib/garage/types";

type Props = {
  garageId: string;
  settings: GarageSettings | null;
};

export function PriceMemorySettings({ garageId, settings }: Props) {
  const custom = (settings?.custom_settings as { price_memory_enabled?: boolean } | undefined) ?? {};
  const [priceMemoryEnabled, setPriceMemoryEnabled] = useState(custom.price_memory_enabled !== false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const result = await updateGarageSettingsAction(garageId, {
      custom_settings: { price_memory_enabled: priceMemoryEnabled },
    });
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Paramètre enregistré");
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5" />
          Devis
        </CardTitle>
        <CardDescription>
          Mémoire de prix : réutiliser les prix que vous modifiez manuellement pour les prochains devis similaires
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="price_memory_enabled">Utiliser les prix enregistrés du garage</Label>
            <p className="text-xs text-muted-foreground">
              Lors de la génération IA, les prix que vous avez déjà modifiés et enregistrés seront appliqués par défaut
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="price_memory_enabled"
              type="checkbox"
              checked={priceMemoryEnabled}
              onChange={(e) => setPriceMemoryEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
        <div className="pt-2 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
