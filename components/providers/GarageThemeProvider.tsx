"use client";

import { useEffect } from "react";
import { useGarage } from "./GarageProvider";
import { getThemeColors } from "@/lib/garage/getAppearanceSettings";

/**
 * Convertit une couleur hex (#RRGGBB) en HSL pour Tailwind
 * Format attendu par Tailwind: "hue saturation% lightness%"
 */
function hexToHsl(hex: string): string {
  // Retirer le # si présent
  hex = hex.replace("#", "");
  
  // Convertir en RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number, l: number;

  l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatique
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
      default: h = 0;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}

export function GarageThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useGarage();
  const colors = getThemeColors(settings);
  
  useEffect(() => {
    const root = document.documentElement;
    
    // Variables pour usage futur (--garage-primary, --garage-accent)
    root.style.setProperty("--garage-primary", colors.primary);
    root.style.setProperty("--garage-accent", colors.accent);
    
    // Surcharger --primary pour que bg-primary utilise la couleur du garage
    // Convertir hex en HSL pour Tailwind
    const primaryHsl = hexToHsl(colors.primary);
    root.style.setProperty("--primary", primaryHsl);
    
    // Mettre à jour --secondary pour qu'il utilise aussi la couleur principale
    // (utilisé par les boutons "Actifs" et autres éléments secondaires actifs)
    root.style.setProperty("--secondary", primaryHsl);
    
    // Le texte sur secondary doit être blanc (comme primary-foreground) pour être lisible
    root.style.setProperty("--secondary-foreground", "0 0% 100%");
    
    return () => {
      root.style.removeProperty("--garage-primary");
      root.style.removeProperty("--garage-accent");
      root.style.removeProperty("--primary");
      root.style.removeProperty("--secondary");
      root.style.removeProperty("--secondary-foreground");
    };
  }, [colors.primary, colors.accent]);
  
  return <>{children}</>;
}
