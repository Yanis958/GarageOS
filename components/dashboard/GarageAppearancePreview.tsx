"use client";

import { Card } from "@/components/ui/card";
import type { GarageAppearanceSettings } from "@/lib/garage/types";

type PreviewProps = {
  primaryColor: string;
  accentColor: string;
  logoUrl?: string | null;
  appearance: GarageAppearanceSettings;
};

export function GarageAppearancePreview({
  primaryColor,
  accentColor,
  logoUrl,
  appearance,
}: PreviewProps) {
  return (
    <Card className="p-4 border-2">
      <div className="space-y-3">
        {/* Header preview */}
        <div 
          className="h-12 rounded flex items-center px-4"
          style={{ backgroundColor: primaryColor }}
        >
          {logoUrl && (
            <img src={logoUrl} alt="Logo" className="h-8 w-auto mr-3" />
          )}
          <span className="text-white font-semibold">Nom du garage</span>
        </div>
        
        {/* Sidebar preview */}
        <div className="flex gap-2">
          <div 
            className="w-16 h-32 rounded"
            style={{ backgroundColor: accentColor, opacity: 0.1 }}
          />
          <div className="flex-1">
            <div className="h-8 rounded mb-2 bg-muted" />
            <div className="h-8 rounded mb-2 bg-muted" />
            <div className="h-8 rounded" />
          </div>
        </div>
        
        {/* Footer preview */}
        {appearance.footer_text && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            {appearance.footer_text}
          </div>
        )}
      </div>
    </Card>
  );
}
