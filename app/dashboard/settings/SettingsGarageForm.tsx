"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Upload, FileText, Trash2, Bell } from "lucide-react";
import { updateGarageAction, updateGarageSettingsAction, uploadGarageLogoAction, removeGarageLogoAction } from "@/lib/actions/garage";
import type { GarageWithSettings } from "@/lib/garage/types";
import { generateDevisPdf } from "@/lib/pdf-devis/generate";
import type { PdfDevisPayload } from "@/lib/pdf-devis/types";

export function SettingsGarageForm({ garageWithSettings }: { garageWithSettings: GarageWithSettings | null }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const garage = garageWithSettings?.garage ?? null;
  const initialSettings = garageWithSettings?.settings ?? null;

  const [name, setName] = useState(garage?.name ?? "");
  const [address, setAddress] = useState(initialSettings?.address ?? garage?.address ?? "");
  const [phone, setPhone] = useState(initialSettings?.phone ?? "");
  const [email, setEmail] = useState(initialSettings?.email ?? "");
  const [siret, setSiret] = useState(initialSettings?.siret ?? "");
  const [hourlyRate, setHourlyRate] = useState(String(initialSettings?.hourly_rate ?? 60));
  const [vatRate, setVatRate] = useState(String(initialSettings?.vat_rate ?? 20));
  const [currency, setCurrency] = useState(initialSettings?.currency ?? "EUR");
  const [quoteValidDays, setQuoteValidDays] = useState(String(initialSettings?.quote_valid_days ?? 30));
  const [pdfFooter, setPdfFooter] = useState(initialSettings?.pdf_footer ?? "");
  const [emailSignature, setEmailSignature] = useState(initialSettings?.email_signature ?? "");
  const [primaryColor, setPrimaryColor] = useState(initialSettings?.primary_color ?? "");
  const [emailSubject, setEmailSubject] = useState(initialSettings?.email_subject ?? "Votre devis - {reference}");
  const [includeClientExplanationInEmail, setIncludeClientExplanationInEmail] = useState(initialSettings?.include_client_explanation_in_email ?? true);
  const [remindersEnabled, setRemindersEnabled] = useState(initialSettings?.reminders_enabled ?? true);
  const [logoUrl, setLogoUrl] = useState(initialSettings?.logo_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [previewingPdf, setPreviewingPdf] = useState(false);

  async function handleSaveIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (!garage) return;
    setSaving(true);
    const err1 = await updateGarageAction(garage.id, { name: name.trim() || null, address: address.trim() || null });
    const err2 = await updateGarageSettingsAction(garage.id, {
      address: address.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      siret: siret.trim() || null,
    });
    setSaving(false);
    if (err1.error) toast.error(err1.error);
    else if (err2.error) toast.error(err2.error);
    else {
      toast.success("Identité enregistrée.");
      try {
        await fetch('/api/revalidate?path=/dashboard', { method: 'POST' });
        await fetch('/api/revalidate?path=/dashboard/settings', { method: 'POST' });
      } catch (e) {
        console.error("Erreur revalidation:", e);
      }
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }

  async function handleSaveBilling(e: React.FormEvent) {
    e.preventDefault();
    if (!garage) return;
    setSaving(true);
    const err = await updateGarageSettingsAction(garage.id, {
      hourly_rate: parseFloat(hourlyRate) || 60,
      vat_rate: parseFloat(vatRate) || 20,
      currency: currency.trim() || "EUR",
      quote_valid_days: parseInt(quoteValidDays, 10) || 30,
    });
    setSaving(false);
    if (err.error) toast.error(err.error);
    else {
      toast.success("Devis & facturation enregistrés.");
      try {
        await fetch('/api/revalidate?path=/dashboard', { method: 'POST' });
        await fetch('/api/revalidate?path=/dashboard/settings', { method: 'POST' });
      } catch (e) {
        console.error("Erreur revalidation:", e);
      }
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }

  async function handleSaveDocuments(e: React.FormEvent) {
    e.preventDefault();
    if (!garage) return;
    setSaving(true);
    const err = await updateGarageSettingsAction(garage.id, {
      pdf_footer: pdfFooter.trim() || null,
      email_signature: emailSignature.trim() || null,
      primary_color: primaryColor.trim() || null,
      email_subject: emailSubject.trim() || null,
      include_client_explanation_in_email: includeClientExplanationInEmail,
    });
    setSaving(false);
    if (err.error) toast.error(err.error);
    else {
      toast.success("Documents enregistrés.");
      try {
        await fetch('/api/revalidate?path=/dashboard', { method: 'POST' });
        await fetch('/api/revalidate?path=/dashboard/settings', { method: 'POST' });
      } catch (e) {
        console.error("Erreur revalidation:", e);
      }
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const formData = new FormData();
    formData.set("file", file);
    const res = await uploadGarageLogoAction(formData);
    setUploadingLogo(false);
    if (res.error) toast.error(res.error);
    else if (res.logoUrl) {
      setLogoUrl(res.logoUrl);
      toast.success("Logo mis à jour.");
      router.refresh();
    }
    e.target.value = "";
  }

  async function handlePreviewPdf() {
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      toast.error("Autorisez les popups pour prévisualiser le PDF.");
      return;
    }
    setPreviewingPdf(true);
    try {
      const now = new Date();
      const validUntilDate = new Date(Date.now() + (parseInt(quoteValidDays, 10) || 30) * 86400000);
      const payload: PdfDevisPayload = {
        reference: "Aperçu",
        createdAt: now.toISOString().slice(0, 10),
        validUntil: validUntilDate.toISOString().slice(0, 10),
        client: { name: "Client exemple" },
        vehicle: { brand: "Véhicule", model: "exemple", registration: null },
        lines: [
          { type: "labor", typeLabel: "Main-d'œuvre", description: "Exemple 1h", quantity: 1, unitPrice: parseFloat(hourlyRate) || 60, totalHt: parseFloat(hourlyRate) || 60 },
          { type: "part", typeLabel: "Pièce", description: "Exemple pièce", quantity: 1, unitPrice: 50, totalHt: 50 },
        ],
        totalHt: 110,
        totalTva: Math.round(110 * ((parseFloat(vatRate) || 20) / 100) * 100) / 100,
        totalTtc: Math.round(110 * (1 + (parseFloat(vatRate) || 20) / 100) * 100) / 100,
        notesClient: null,
        issuedAt: now.toISOString().slice(0, 10),
        garage: {
          name: name || null,
          address: address || null,
          phone: phone || null,
          email: email || null,
          siret: siret || null,
          logo_url: logoUrl?.trim() || null,
        },
        vatRate: parseFloat(vatRate) || 20,
        pdfFooter: pdfFooter.trim() || undefined,
        quoteValidDays: parseInt(quoteValidDays, 10) || 30,
      };
      const bytes = await generateDevisPdf(payload);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      console.error(e);
      previewWindow.close();
      toast.error("Erreur lors de la prévisualisation.");
    } finally {
      setPreviewingPdf(false);
    }
  }

  async function handleRemoveLogo() {
    setRemovingLogo(true);
    const err = await removeGarageLogoAction();
    setRemovingLogo(false);
    if (err.error) toast.error(err.error);
    else {
      setLogoUrl("");
      toast.success("Logo supprimé.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Identité */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Building2 className="h-5 w-5" />
            Identité
          </CardTitle>
          <CardDescription>Nom et coordonnées du garage</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveIdentity} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="garage-name">Nom du garage</Label>
                <Input id="garage-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. PAC AUTO" className="max-w-md" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-address">Adresse</Label>
                <Input id="garage-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adresse" className="max-w-md" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-phone">Téléphone</Label>
                <Input id="garage-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Tél." className="max-w-md" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-email">Email</Label>
                <Input id="garage-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" className="max-w-md" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="garage-siret">SIRET</Label>
                <Input id="garage-siret" value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="SIRET" className="max-w-md" />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer l'identité"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Devis & facturation */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Devis & facturation</CardTitle>
          <CardDescription>Taux horaire, TVA, validité des devis</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveBilling} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="hourly-rate">Taux horaire par défaut (€ HT)</Label>
                <Input id="hourly-rate" type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} className="max-w-[140px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat-rate">Taux de TVA (%)</Label>
                <Input id="vat-rate" type="number" min="0" max="100" step="0.1" value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="max-w-[100px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Devise</Label>
                <Input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="EUR" className="max-w-[80px]" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quote-valid-days">Validité devis (jours)</Label>
                <Input id="quote-valid-days" type="number" min="1" value={quoteValidDays} onChange={(e) => setQuoteValidDays(e.target.value)} className="max-w-[80px]" />
              </div>
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Documents : pied de page devis, signature email, logo */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <FileText className="h-5 w-5" />
            Documents
          </CardTitle>
          <CardDescription>Texte en bas des devis, signature des mails, logo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSaveDocuments} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-footer">Texte en bas de page des devis</Label>
              <Textarea id="pdf-footer" value={pdfFooter} onChange={(e) => setPdfFooter(e.target.value)} placeholder="Ce devis est valable 30 jours…" className="min-h-[60px]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-signature">Signature des emails</Label>
              <p className="text-xs text-muted-foreground">Ce texte sera ajouté en bas de chaque devis envoyé par email. Écrivez-le dans le cadre ci-dessous.</p>
              <Textarea id="email-signature" value={emailSignature} onChange={(e) => setEmailSignature(e.target.value)} placeholder="Ex. Cordialement, L'équipe du garage" className="min-h-[80px]" />
              <p className="text-xs text-muted-foreground">Aperçu (lecture seule) :</p>
              <div className="rounded-lg border border-border bg-muted/30 p-4 min-h-[72px]">
                {emailSignature.trim() ? (
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans m-0">
                    {emailSignature.trim()}
                  </pre>
                ) : (
                  <p className="text-sm text-muted-foreground m-0 italic">
                    Tapez votre signature dans le champ ci-dessus pour voir l’aperçu ici.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Sujet des emails de devis</Label>
              <Input id="email-subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Votre devis - {reference}" className="max-w-md" />
              <p className="text-xs text-muted-foreground">Utilisez {"{reference}"} pour insérer la référence du devis.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="include-explanation"
                type="checkbox"
                checked={includeClientExplanationInEmail}
                onChange={(e) => setIncludeClientExplanationInEmail(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="include-explanation" className="cursor-pointer font-normal">
                Inclure l’explication client (IA) dans l’email quand elle est générée
              </Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary-color">Couleur d'accent (optionnel)</Label>
              <Input id="primary-color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="ex. #7C3AED" className="max-w-[120px]" />
            </div>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>

          <div className="space-y-2">
            <Label>Logo du garage</Label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain rounded border border-border" />
              ) : null}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploadingLogo ? "Envoi en cours…" : "Choisir un logo"}
                </Button>
                {logoUrl ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleRemoveLogo} disabled={removingLogo}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {removingLogo ? "Suppression…" : "Supprimer"}
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Si le logo ne s'ajoute pas, une configuration côté hébergeur peut être nécessaire.</p>
          </div>

          <div className="pt-4 border-t border-border">
            <Label className="text-sm">Aperçu PDF</Label>
            <p className="text-xs text-muted-foreground mb-2">Ouvre un exemple de devis avec vos paramètres actuels.</p>
            <Button type="button" variant="outline" size="sm" onClick={handlePreviewPdf} disabled={previewingPdf}>
              <FileText className="h-4 w-4 mr-2" />
              {previewingPdf ? "Génération…" : "Prévisualiser le PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rappels */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Bell className="h-5 w-5" />
            Rappels
          </CardTitle>
          <CardDescription>Devis expirés et à relancer : notifications dans l&apos;app (cloche en haut)</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!garage) return;
              setSaving(true);
              const err = await updateGarageSettingsAction(garage.id, { reminders_enabled: remindersEnabled });
              setSaving(false);
              if (err.error) toast.error(err.error);
              else {
                toast.success("Préférence enregistrée.");
                try {
                  await fetch('/api/revalidate?path=/dashboard', { method: 'POST' });
                  await fetch('/api/revalidate?path=/dashboard/settings', { method: 'POST' });
                } catch (e) {
                  console.error("Erreur revalidation:", e);
                }
                setTimeout(() => {
                  window.location.reload();
                }, 300);
              }
            }}
            className="flex flex-wrap items-center gap-4"
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={remindersEnabled}
                onChange={(e) => setRemindersEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm font-medium text-foreground">Activer les rappels (devis expirés, à relancer)</span>
            </label>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
