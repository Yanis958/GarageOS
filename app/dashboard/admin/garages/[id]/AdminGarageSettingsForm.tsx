"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateGarageSettingsAdmin } from "@/lib/actions/admin";
import type { GarageSettings } from "@/lib/garage/types";

export function AdminGarageSettingsForm({
  garageId,
  initialSettings,
}: {
  garageId: string;
  initialSettings: GarageSettings | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(String(initialSettings?.hourly_rate ?? 60));
  const [vatRate, setVatRate] = useState(String(initialSettings?.vat_rate ?? 20));
  const [currency, setCurrency] = useState(initialSettings?.currency ?? "EUR");
  const [quoteValidDays, setQuoteValidDays] = useState(String(initialSettings?.quote_valid_days ?? 30));
  const [pdfFooter, setPdfFooter] = useState(initialSettings?.pdf_footer ?? "");
  const [emailSignature, setEmailSignature] = useState(initialSettings?.email_signature ?? "");
  const [emailSubject, setEmailSubject] = useState(initialSettings?.email_subject ?? "Votre devis - {reference}");
  const [includeExplanation, setIncludeExplanation] = useState(initialSettings?.include_client_explanation_in_email ?? true);
  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await updateGarageSettingsAdmin(garageId, {
      hourly_rate: parseFloat(hourlyRate) || 60,
      vat_rate: parseFloat(vatRate) || 20,
      currency: currency.trim() || "EUR",
      quote_valid_days: parseInt(quoteValidDays, 10) || 30,
      pdf_footer: pdfFooter.trim() || null,
      email_signature: emailSignature.trim() || null,
      email_subject: emailSubject.trim() || null,
      include_client_explanation_in_email: includeExplanation,
      primary_color: primaryColor.trim() || null,
    });
    setSaving(false);
    if (err.error) toast.error(err.error);
    else {
      toast.success("Paramètres enregistrés.");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Paramètres (templates, TVA, taux)</CardTitle>
          <CardDescription>Modification des réglages du garage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hourly_rate">Taux horaire (€ HT)</Label>
              <Input id="hourly_rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_rate">TVA (%)</Label>
              <Input id="vat_rate" type="number" min="0" max="100" step="0.1" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quote_valid_days">Validité devis (jours)</Label>
              <Input id="quote_valid_days" type="number" min="1" value={quoteValidDays} onChange={(e) => setQuoteValidDays(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pdf_footer">Texte en bas de page des devis</Label>
            <Textarea id="pdf_footer" value={pdfFooter} onChange={(e) => setPdfFooter(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email_signature">Signature des emails</Label>
            <Textarea id="email_signature" value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email_subject">Sujet des emails de devis</Label>
            <Input id="email_subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Votre devis - {reference}" />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="include_explanation"
              type="checkbox"
              checked={includeExplanation}
              onChange={(e) => setIncludeExplanation(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="include_explanation" className="font-normal">Inclure l’explication client (IA) dans l’email</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="primary_color">Couleur d’accent</Label>
            <Input id="primary_color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#2563eb" className="max-w-[120px]" />
          </div>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
