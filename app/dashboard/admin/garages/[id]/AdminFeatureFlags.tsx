"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { setFeatureFlagAdmin } from "@/lib/actions/admin";

const FEATURE_LABELS: Record<string, string> = {
  ai_quote_explain: "Explication devis (IA)",
  ai_copilot: "Copilot",
  ai_insights: "Analyse / Insights",
  ai_quote_audit: "Audit devis (IA)",
  ai_generate_lines: "Génération lignes devis (IA)",
  ai_planning: "Suggestions planning (IA)",
  ai_quick_note: "Quick note (IA)",
  ai_client_message: "Message client (IA)",
};

export function AdminFeatureFlags({
  garageId,
  initialFlags,
}: {
  garageId: string;
  initialFlags: { feature_key: string; enabled: boolean }[];
}) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);
  const map = new Map(initialFlags.map((f) => [f.feature_key, f.enabled]));

  async function toggle(key: string, enabled: boolean) {
    setUpdating(key);
    const err = await setFeatureFlagAdmin(garageId, key, enabled);
    setUpdating(null);
    if (err.error) toast.error(err.error);
    else {
      toast.success(enabled ? "Fonctionnalité activée." : "Fonctionnalité désactivée.");
      router.refresh();
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-foreground">Fonctionnalités (feature flags)</CardTitle>
        <CardDescription>Activer ou désactiver les fonctionnalités IA par garage</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {initialFlags.map((f) => (
            <li key={f.feature_key} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <Label className="font-normal cursor-pointer flex-1">
                {FEATURE_LABELS[f.feature_key] ?? f.feature_key}
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {map.get(f.feature_key) ? "Activé" : "Désactivé"}
                </span>
                <button
                  type="button"
                  disabled={updating === f.feature_key}
                  onClick={() => toggle(f.feature_key, !map.get(f.feature_key))}
                  className="text-sm text-primary hover:underline disabled:opacity-50"
                >
                  {updating === f.feature_key ? "…" : map.get(f.feature_key) ? "Désactiver" : "Activer"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
