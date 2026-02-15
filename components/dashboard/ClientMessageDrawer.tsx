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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Mail, MessageSquare, Loader2 } from "lucide-react";
import type { ClientMessageTemplate } from "@/lib/ai/client-message-types";

const TEMPLATE_LABELS: Record<ClientMessageTemplate, string> = {
  relance_j2: "Relance devis (J+2)",
  relance_j7: "Relance devis (J+7)",
  demande_accord: "Demande d'accord",
  vehicule_pret: "Véhicule prêt",
  demande_infos: "Demande infos complémentaires",
};

export type ClientMessageContext = {
  clientName: string;
  vehicleLabel?: string;
  quoteRef?: string;
  totalTtc?: number;
  validUntil?: string | null;
};

export function ClientMessageDrawer({
  open,
  onOpenChange,
  context,
  clientEmail,
  clientPhone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ClientMessageContext;
  clientEmail?: string | null;
  clientPhone?: string | null;
}) {
  const [template, setTemplate] = useState<ClientMessageTemplate>("relance_j2");
  const [status, setStatus] = useState<"idle" | "loading" | "result" | "error">("idle");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sms, setSms] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const FALLBACK_MSG = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

  const handleGenerate = async () => {
    setStatus("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/ai/client-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          clientName: context.clientName,
          vehicleLabel: context.vehicleLabel || undefined,
          quoteRef: context.quoteRef || undefined,
          totalTtc: context.totalTtc,
          validUntil: context.validUntil ?? undefined,
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
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
      setSms(data.sms ?? "");
      setStatus("result");
      toast.success("Généré");
    } catch {
      setErrorMessage(FALLBACK_MSG);
      setStatus("error");
    }
  };

  const handleCopyEmail = () => {
    const text = `Sujet: ${subject}\n\n${body}`;
    void navigator.clipboard.writeText(text);
    toast.success("Email copié");
  };

  const handleCopySms = () => {
    void navigator.clipboard.writeText(sms);
    toast.success("SMS copié");
  };

  const handleSendEmail = () => {
    const email = clientEmail?.trim();
    if (!email) {
      toast.error("Indiquez l'email du client dans sa fiche.");
      return;
    }
    const url = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    toast.success("Ouverture de votre messagerie…");
  };

  const handleSendSms = () => {
    const phone = clientPhone?.trim();
    if (phone) {
      const url = `sms:${phone.replace(/\s/g, "")}?body=${encodeURIComponent(sms)}`;
      window.location.href = url;
      toast.success("Ouverture de l'app SMS…");
    } else {
      void navigator.clipboard.writeText(sms);
      toast.success("SMS copié. Collez-le dans votre app de messagerie.");
    }
  };

  const resetWhenClosed = (isOpen: boolean) => {
    if (!isOpen) {
      setStatus("idle");
      setSubject("");
      setBody("");
      setSms("");
      setErrorMessage(null);
    }
    onOpenChange(isOpen);
  };

  return (
    <Sheet open={open} onOpenChange={resetWhenClosed}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Générer message</SheetTitle>
          <SheetDescription>
            Choisissez un type de message, générez le texte puis copiez ou envoyez par email / SMS.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div>
            <Label className="text-sm font-medium text-foreground">Type de message</Label>
            <div className="mt-2 flex flex-col gap-1.5">
              {(Object.keys(TEMPLATE_LABELS) as ClientMessageTemplate[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTemplate(t)}
                  className={`rounded-button border px-3 py-2 text-left text-sm transition-all duration-200 ${
                    template === t
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {TEMPLATE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {status === "idle" && (
            <Button
              className="w-full rounded-button bg-primary text-primary-foreground"
              onClick={handleGenerate}
              disabled={!context.clientName?.trim()}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Générer
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

          {status === "result" && (
            <>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-foreground">Sujet (email)</Label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="mt-1.5 rounded-input"
                    placeholder="Sujet"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">Corps (email)</Label>
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="mt-1.5 min-h-[100px] rounded-input"
                    placeholder="Message email"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground">SMS</Label>
                  <Textarea
                    value={sms}
                    onChange={(e) => setSms(e.target.value)}
                    className="mt-1.5 min-h-[80px] rounded-input"
                    placeholder="Message SMS"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="w-full rounded-button" onClick={handleCopyEmail}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copier email
                </Button>
                <Button variant="outline" size="sm" className="w-full rounded-button" onClick={handleCopySms}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copier SMS
                </Button>
                <Button variant="outline" size="sm" className="w-full rounded-button" onClick={handleSendEmail}>
                  <Mail className="h-4 w-4 mr-2" />
                  Envoyer par email
                </Button>
                <Button variant="outline" size="sm" className="w-full rounded-button" onClick={handleSendSms}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Envoyer par SMS
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
