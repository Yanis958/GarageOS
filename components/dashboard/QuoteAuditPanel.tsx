"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, Check, X, CheckCircle2, AlertTriangle } from "lucide-react";
import type { DevisLine } from "@/components/dashboard/DevisLineEditor";
import type { Finding } from "@/lib/ai/quote-audit-types";
import { applyFinding, applyAllFindings } from "@/lib/ai/apply-audit-fix";

type QuoteAuditPanelProps = {
  quoteId: string;
  lines: DevisLine[];
  onApplyFix: (nextLines: DevisLine[]) => void;
  disabled?: boolean;
  /** Taux horaire (€) depuis garage_settings */
  hourlyRate?: number;
  /** Déclencher automatiquement la vérification après génération IA */
  autoTrigger?: boolean;
};

export function QuoteAuditPanel({
  quoteId,
  lines,
  onApplyFix,
  disabled = false,
  hourlyRate = 60,
  autoTrigger = false,
}: QuoteAuditPanelProps) {
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  const FALLBACK_MSG = "Impossible de vérifier automatiquement. Vous pouvez continuer.";

  async function handleAnalyze() {
    setLoading(true);
    setFindings(null);
    setIgnoredIds(new Set());
    setErrorMessage(null);
    try {
      const res = await fetch("/api/ai/quote-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          lines: lines.map((l) => ({
            id: l.id,
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            total: l.total,
            type: l.type,
            optional: l.optional,
          })),
          hourlyRate,
        }),
      });
      const data = await res.json();
      if (data.error) {
        const msg = typeof data.error === "string" ? data.error : FALLBACK_MSG;
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }
      setFindings(data.findings ?? []);
    } catch {
      setErrorMessage(FALLBACK_MSG);
      toast.error(FALLBACK_MSG);
    } finally {
      setLoading(false);
    }
  }

  function handleApplyOne(finding: Finding) {
    const next = applyFinding(finding, lines);
    onApplyFix(next);
    setIgnoredIds((prev) => new Set(prev).add(finding.id));
  }

  function handleApplyAll() {
    if (applicableFindings.length === 0) return;
    const next = applyAllFindings(applicableFindings, lines);
    onApplyFix(next);
    setIgnoredIds((prev) => {
      const nextSet = new Set(prev);
      applicableFindings.forEach((f) => nextSet.add(f.id));
      return nextSet;
    });
  }

  function handleIgnore(finding: Finding) {
    setIgnoredIds((prev) => new Set(prev).add(finding.id));
  }

  // Déclenchement automatique après génération IA
  useEffect(() => {
    if (autoTrigger && lines.length > 0 && !hasAutoTriggered && !loading && !findings) {
      setHasAutoTriggered(true);
      void handleAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger, lines.length, hasAutoTriggered, loading, findings]);

  // Réinitialiser le flag si les lignes changent significativement
  useEffect(() => {
    if (lines.length === 0) {
      setHasAutoTriggered(false);
      setFindings(null);
    }
  }, [lines.length]);

  const visibleFindings = findings?.filter((f) => !ignoredIds.has(f.id)) ?? [];
  const applicableFindings = visibleFindings.filter((f) => f.proposedFix?.payload);
  const hasIssues = visibleFindings.length > 0;

  return (
    <Card className="rounded-[20px] border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-4 border-b border-border/50">
        <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Vérification du devis
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {errorMessage && !loading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive space-y-2">
            <p>{errorMessage}</p>
            <Button variant="outline" size="sm" className="rounded-button" onClick={() => void handleAnalyze()}>
              Réessayer
            </Button>
          </div>
        )}

        {!findings && !loading && !errorMessage && !autoTrigger && (
          <Button
            onClick={handleAnalyze}
            disabled={disabled || lines.length === 0}
            variant="outline"
            className="w-full rounded-button"
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Vérifier le devis
          </Button>
        )}

        {loading && (
          <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification en cours…
          </div>
        )}

        {findings && !loading && (
          <>
            {!hasIssues ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="font-medium">Devis cohérent</span>
              </div>
            ) : (
              <>
                {applicableFindings.length > 0 && (
                  <Button
                    onClick={handleApplyAll}
                    size="sm"
                    className="w-full rounded-button bg-primary text-primary-foreground"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Corriger automatiquement
                  </Button>
                )}
                <ul className="space-y-2">
                  {visibleFindings.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 text-sm"
                    >
                      <div className="min-w-0 flex-1 flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{f.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {f.proposedFix?.payload && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 rounded-button text-xs"
                            onClick={() => handleApplyOne(f)}
                          >
                            Corriger
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 rounded-button"
                          onClick={() => handleIgnore(f)}
                          title="Ignorer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
