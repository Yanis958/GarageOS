"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Copy, FileText, Mail, Loader2, Sparkles } from "lucide-react";
import type { DevisLine } from "@/components/dashboard/DevisLineEditor";
import type { QuoteExplainResponse } from "@/lib/ai/quote-explain-types";

function formatFullText(data: QuoteExplainResponse): string {
  const detailedBlock = data.detailed.map((d) => `• ${d}`).join("\n");
  const faqBlock = data.faq.map((f) => `${f.q}\n${f.a}`).join("\n\n");
  return [data.short, "", detailedBlock, "", faqBlock].filter(Boolean).join("\n");
}

export function QuoteExplainDrawer({
  open,
  onOpenChange,
  quoteId,
  lines,
  totalHt,
  totalTva,
  totalTtc,
  durationEstimate,
  onAddToPdf,
  onAddToEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  lines: DevisLine[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  durationEstimate: string;
  onAddToPdf: (text: string) => void;
  onAddToEmail: (text: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "result" | "error">("idle");
  const [result, setResult] = useState<QuoteExplainResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const FALLBACK_MSG = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

  const handleGenerate = async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/ai/quote-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId,
          lines: lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_price: l.unit_price,
            total: l.total,
            type: l.type ?? "part",
            optional: l.optional,
            optional_reason: l.optional_reason,
          })),
          totalHt,
          totalTva,
          totalTtc,
          durationEstimate: durationEstimate || undefined,
        }),
      });
      const data = await res.json();
      if (data.fallback === true || data.error) {
        setErrorMessage(typeof data.error === "string" ? data.error : FALLBACK_MSG);
        setStatus("error");
        return;
      }
      if (!res.ok) {
        setErrorMessage(typeof data.error === "string" ? data.error : FALLBACK_MSG);
        setStatus("error");
        return;
      }
      setResult(data as QuoteExplainResponse);
      setStatus("result");
      toast.success("Généré");
    } catch {
      setErrorMessage(FALLBACK_MSG);
      setStatus("error");
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = formatFullText(result);
    void navigator.clipboard.writeText(text);
    toast.success("Copié dans le presse-papier");
  };

  const handleAddToPdf = () => {
    if (!result) return;
    const text = formatFullText(result);
    onAddToPdf(text);
    toast.success("Ajouté au PDF. Téléchargez ou envoyez le devis pour l'inclure.");
    onOpenChange(false);
  };

  const handleAddToEmail = () => {
    if (!result) return;
    const text = formatFullText(result);
    onAddToEmail(text);
    toast.success("Ajouté au message d'envoi.");
    onOpenChange(false);
  }

  const resetWhenClosed = (open: boolean) => {
    if (!open) {
      setStatus("idle");
      setResult(null);
      setErrorMessage(null);
    }
    onOpenChange(open);
  };

  return (
    <Sheet open={open} onOpenChange={resetWhenClosed}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Expliquer ce devis au client</SheetTitle>
          <SheetDescription>
            Générez une explication simple et rassurante à envoyer ou inclure au PDF.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {status === "idle" && (
            <Button
              className="w-full rounded-button bg-primary text-primary-foreground"
              onClick={handleGenerate}
              disabled={lines.length === 0}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Générer l&apos;explication
            </Button>
          )}

          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Génération en cours…</p>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {errorMessage}
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => { setErrorMessage(null); void handleGenerate(); }}
              >
                Réessayer
              </Button>
            </div>
          )}

          {status === "result" && result && (
            <>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Version courte</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.short}</p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Détails</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {result.detailed.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Points rassurants</h4>
                  <div className="space-y-3">
                    {result.faq.map((f, i) => (
                      <div key={i} className="text-sm">
                        <p className="font-medium text-foreground">{f.q}</p>
                        <p className="text-muted-foreground mt-0.5">{f.a}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-button"
                  onClick={handleCopy}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copier
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-button"
                  onClick={handleAddToPdf}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Ajouter au PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-button"
                  onClick={handleAddToEmail}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Ajouter au message d&apos;envoi
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
