"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Palette } from "lucide-react";
import { updateGarageSettingsAction, uploadGarageLogoAction } from "@/lib/actions/garage";
import { GarageAppearancePreview } from "./GarageAppearancePreview";
import { getAppearanceSettings, getThemeColors } from "@/lib/garage/getAppearanceSettings";
import type { GarageSettings } from "@/lib/garage/types";

type Props = {
  garageId: string;
  settings: GarageSettings | null;
};

export function GarageAppearanceSettings({ garageId, settings }: Props) {
  const router = useRouter();
  const appearance = getAppearanceSettings(settings);
  const colors = getThemeColors(settings);
  
  const [primaryColor, setPrimaryColor] = useState(colors.primary);
  const [accentColor, setAccentColor] = useState(colors.accent);
  const [footerText, setFooterText] = useState(appearance.footer_text ?? "");
  const [showLogoOnPdf, setShowLogoOnPdf] = useState(appearance.show_logo_on_pdf ?? true);
  const [enableCompactMode, setEnableCompactMode] = useState(appearance.enable_compact_mode ?? false);
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  async function handleSave() {
    setSaving(true);
    const result = await updateGarageSettingsAction(garageId, {
      theme_primary: primaryColor,
      theme_accent: accentColor,
      custom_settings: {
        appearance: {
          footer_text: footerText.trim() || null,
          show_logo_on_pdf: showLogoOnPdf,
          enable_compact_mode: enableCompactMode,
        },
      },
    });
    
    setSaving(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Apparence enregistrée");
      // Forcer le rechargement pour appliquer les nouvelles couleurs
      window.location.reload();
    }
  }
  
  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);
    
    const result = await uploadGarageLogoAction(formData);
    setUploadingLogo(false);
    
    if (result.error) {
      toast.error(result.error);
    } else if (result.logoUrl) {
      setLogoUrl(result.logoUrl);
      toast.success("Logo uploadé");
      router.refresh();
    }
  }
  
  function handleReset() {
    setPrimaryColor("#7C3AED");
    setAccentColor("#22C55E");
    setFooterText("");
    setShowLogoOnPdf(true);
    setEnableCompactMode(false);
  }
  
  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Palette className="h-5 w-5" />
          Apparence
        </CardTitle>
        <CardDescription>
          Personnalisez les couleurs, logo et préférences visuelles de votre garage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview */}
        <div>
          <Label className="mb-2 block">Aperçu</Label>
          <GarageAppearancePreview
            primaryColor={primaryColor}
            accentColor={accentColor}
            logoUrl={logoUrl}
            appearance={{
              footer_text: footerText,
              show_logo_on_pdf: showLogoOnPdf,
              enable_compact_mode: enableCompactMode,
            }}
          />
        </div>
        
        {/* Couleurs */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="primary_color">Couleur principale</Label>
            <div className="flex gap-2">
              <Input
                id="primary_color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#7C3AED"
                className="flex-1"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="accent_color">Couleur d&apos;accent</Label>
            <div className="flex gap-2">
              <Input
                id="accent_color"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-20 h-10"
              />
              <Input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#22C55E"
                className="flex-1"
              />
            </div>
          </div>
        </div>
        
        {/* Logo */}
        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-12 w-auto" />
            )}
            <Input
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              disabled={uploadingLogo}
              className="flex-1"
            />
          </div>
        </div>
        
        {/* Footer text */}
        <div className="space-y-2">
          <Label htmlFor="footer_text">Texte du footer</Label>
          <Textarea
            id="footer_text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder="Merci de votre confiance"
            rows={2}
          />
        </div>
        
        {/* Switches */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show_logo_on_pdf">Afficher le logo sur les PDF</Label>
              <p className="text-xs text-muted-foreground">
                Le logo apparaîtra dans l&apos;en-tête des devis et factures
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="show_logo_on_pdf"
                type="checkbox"
                checked={showLogoOnPdf}
                onChange={(e) => setShowLogoOnPdf(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable_compact_mode">Mode compact</Label>
              <p className="text-xs text-muted-foreground">
                Interface plus dense (expérimental)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="enable_compact_mode"
                type="checkbox"
                checked={enableCompactMode}
                onChange={(e) => setEnableCompactMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Sauvegarder"}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
