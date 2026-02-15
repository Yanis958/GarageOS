import type { GarageSettings, GarageAppearanceSettings } from "./types";

const DEFAULT_APPEARANCE: GarageAppearanceSettings = {
  footer_text: null,
  show_logo_on_pdf: true,
  enable_compact_mode: false,
};

export function getAppearanceSettings(settings: GarageSettings | null): GarageAppearanceSettings {
  if (!settings) return DEFAULT_APPEARANCE;
  
  const custom = settings.custom_settings?.appearance;
  return {
    footer_text: custom?.footer_text ?? DEFAULT_APPEARANCE.footer_text,
    show_logo_on_pdf: custom?.show_logo_on_pdf ?? DEFAULT_APPEARANCE.show_logo_on_pdf,
    enable_compact_mode: custom?.enable_compact_mode ?? DEFAULT_APPEARANCE.enable_compact_mode,
  };
}

export function getThemeColors(settings: GarageSettings | null): {
  primary: string;
  accent: string;
} {
  if (!settings) {
    return { primary: "#7C3AED", accent: "#22C55E" }; // Defaults
  }
  
  return {
    primary: settings.theme_primary ?? settings.primary_color ?? "#7C3AED",
    accent: settings.theme_accent ?? "#22C55E",
  };
}
