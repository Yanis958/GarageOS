"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPlanningAssignment } from "@/lib/actions/planning";
import { SLOT_DISPLAY } from "@/lib/utils/planning";
import type { PlanningSuggestResponse, SlotLabel } from "@/lib/ai/planning-types";
import type { AcceptedQuoteWithDuration } from "@/lib/actions/planning";
import { CalendarClock, Loader2, Check, X } from "lucide-react";
function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

export function PlanningSuggest({
  quote,
  weekStart,
  weekDays,
  onClose,
}: {
  quote: AcceptedQuoteWithDuration;
  weekStart: string;
  weekDays: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<PlanningSuggestResponse | null>(null);
  const [validating, setValidating] = useState(false);

  const FALLBACK_MSG = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

  async function handlePropose() {
    setError(null);
    setSuggestion(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/planning/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id, weekStart }),
      });
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
      setSuggestion(data);
    } catch {
      setError(FALLBACK_MSG);
    } finally {
      setLoading(false);
    }
  }

  async function handleValidate() {
    if (!suggestion) return;
    setValidating(true);
    setError(null);
    try {
      const { error: err } = await createPlanningAssignment(
        quote.id,
        suggestion.recommendedSlot.date,
        suggestion.recommendedSlot.slotLabel as SlotLabel
      );
      if (err) {
        setError(err);
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Devis <span className="font-semibold text-foreground">{quote.reference ?? quote.id.slice(0, 8)}</span>
          {quote.clientName && ` · ${quote.clientName}`} · {quote.durationHours}h estimées
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="shrink-0"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {!suggestion && !loading && (
        <Button
          onClick={handlePropose}
          disabled={loading}
          className="rounded-button bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          Proposer un créneau
        </Button>
      )}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Proposition en cours…
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-2">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="rounded-button" onClick={() => void handlePropose()}>
            Réessayer
          </Button>
        </div>
      )}
      {suggestion && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-4">
          <p className="text-sm font-semibold text-foreground">
            Créneau recommandé : {formatDayLabel(suggestion.recommendedSlot.date)} – {SLOT_DISPLAY[suggestion.recommendedSlot.slotLabel as SlotLabel]}
          </p>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Charge par jour :</span>{" "}
            {weekDays.map((d) => `${formatDayLabel(d).slice(0, 3)} ${suggestion.dailyLoad[d] ?? "—"}`).join(" · ")}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleValidate}
              disabled={validating}
              className="rounded-button bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Valider
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-button">
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
