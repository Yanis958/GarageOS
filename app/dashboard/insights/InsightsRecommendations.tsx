"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { InsightItem } from "@/lib/ai/insights-types";
import { Sparkles, Loader2 } from "lucide-react";

export function InsightsRecommendations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<InsightItem[] | null>(null);

  const FALLBACK_MSG = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

  async function handleGenerate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/insights");
      const data = await res.json().catch(() => ({}));
      if (data.fallback === true || data.error) {
        setError(typeof data.error === "string" ? data.error : FALLBACK_MSG);
        return;
      }
      if (!res.ok) {
        if (res.status === 429) {
          setError("Trop de requêtes. Réessayez dans une minute.");
          return;
        }
        setError(typeof data.error === "string" ? data.error : FALLBACK_MSG);
        return;
      }
      if (Array.isArray(data.insights)) {
        setInsights(data.insights);
      } else {
        setError(FALLBACK_MSG);
      }
    } catch {
      setError(FALLBACK_MSG);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      {!insights && !error && !loading && (
        <p className="text-sm text-muted-foreground">
          Générez des recommandations personnalisées à partir de vos indicateurs.
        </p>
      )}
      {!insights && !loading && (
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-button bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Générer les recommandations
        </Button>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Génération en cours…
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-2">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="rounded-button" onClick={() => void handleGenerate()}>
            Réessayer
          </Button>
        </div>
      )}
      {insights && insights.length > 0 && (
        <ul className="space-y-4">
          {insights.map((item, i) => (
            <li
              key={i}
              className="rounded-lg border border-border bg-muted/20 p-4 text-sm"
            >
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-muted-foreground">{item.why}</p>
              <p className="mt-1.5">
                <span className="font-medium text-foreground">Impact :</span>{" "}
                <span className="text-muted-foreground">{item.impact}</span>
              </p>
              <p className="mt-1.5">
                <span className="font-medium text-foreground">Action :</span>{" "}
                <span className="text-muted-foreground">{item.action}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      {insights && insights.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground">
          Aucune recommandation générée pour le moment. Enrichissez vos données (devis envoyés, acceptés) pour obtenir des recommandations.
        </p>
      )}
    </div>
  );
}
