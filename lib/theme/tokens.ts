/**
 * Système de tokens de thème pour les PDFs
 * Génère des couleurs adaptatives basées sur le thème du garage
 * Garantit toujours un contraste suffisant pour la lisibilité
 */

import { rgb, RGB } from "pdf-lib";

export type ThemeTokens = {
  primary: RGB;
  primary_50: RGB;
  primary_100: RGB;
  primary_600: RGB;
  primary_700: RGB;
  primary_900: RGB;
  accent: RGB;
  accent_50: RGB;
  accent_600: RGB;
  bg: RGB;
  surface: RGB;
  border: RGB;
  text: RGB;
  textSecondary: RGB;
  textMuted: RGB;
  danger: RGB;
  warning: RGB;
  success: RGB;
  white: RGB;
  zebra: RGB;
};

/**
 * Convertit une couleur hex en RGB (0-1)
 * Retourne une couleur par défaut (violet premium) si le hex est invalide
 */
function hexToRgb(hex: string | null | undefined): RGB {
  // Valeur par défaut si hex est null/undefined/vide
  if (!hex || typeof hex !== "string") {
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  const trimmedHex = hex.trim();
  if (trimmedHex === "") {
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  // Retirer le # s'il existe
  const cleanHex = trimmedHex.startsWith("#") ? trimmedHex.slice(1) : trimmedHex;
  
  // Vérifier que c'est un hex valide (6 caractères)
  if (cleanHex.length !== 6) {
    console.warn(`Couleur hex invalide (longueur): "${hex}", utilisation de la couleur par défaut`);
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  // Vérifier le format hex
  if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
    console.warn(`Couleur hex invalide (format): "${hex}", utilisation de la couleur par défaut`);
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Vérifier que les valeurs sont valides (pas NaN)
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn(`Erreur de parsing hex: "${hex}" (r=${r}, g=${g}, b=${b}), utilisation de la couleur par défaut`);
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  // Vérifier que les valeurs sont dans la plage valide
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    console.warn(`Valeurs RGB hors plage: "${hex}" (r=${r}, g=${g}, b=${b}), utilisation de la couleur par défaut`);
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  // Convertir en valeurs 0-1 pour pdf-lib
  const rNormalized = r / 255;
  const gNormalized = g / 255;
  const bNormalized = b / 255;
  
  // Vérification finale avant création de l'objet RGB
  if (isNaN(rNormalized) || isNaN(gNormalized) || isNaN(bNormalized)) {
    console.warn(`Erreur de normalisation RGB: "${hex}", utilisation de la couleur par défaut`);
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  try {
    return rgb(rNormalized, gNormalized, bNormalized);
  } catch (error) {
    console.error(`Erreur lors de la création RGB pour "${hex}":`, error);
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
}

/**
 * Calcule la luminosité relative d'une couleur (0-1)
 * Formule WCAG: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
 */
function getLuminance(color: RGB): number {
  const [r, g, b] = [color.red, color.green, color.blue];
  // Convertir en valeurs linéaires (gamma correction)
  const toLinear = (c: number) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calcule le ratio de contraste entre deux couleurs
 * WCAG: (L1 + 0.05) / (L2 + 0.05) où L1 > L2
 */
function getContrastRatio(color1: RGB, color2: RGB): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Assure un contraste suffisant entre deux couleurs
 * Si le contraste est insuffisant, ajuste la couleur de premier plan
 */
function ensureContrast(foreground: RGB, background: RGB, minRatio = 4.5): RGB {
  // Valider les couleurs d'entrée
  if (isNaN(foreground.red) || isNaN(foreground.green) || isNaN(foreground.blue)) {
    console.warn("ensureContrast: foreground invalide, retour de la couleur par défaut");
    return rgb(0.1, 0.1, 0.1); // Noir pour texte
  }
  
  if (isNaN(background.red) || isNaN(background.green) || isNaN(background.blue)) {
    console.warn("ensureContrast: background invalide, retour de foreground");
    return foreground;
  }

  const ratio = getContrastRatio(foreground, background);
  if (isNaN(ratio) || ratio >= minRatio) {
    return foreground;
  }

  // Ajuster la luminosité pour améliorer le contraste
  const bgLuminance = getLuminance(background);
  const fgLuminance = getLuminance(foreground);

  // Vérifier que les luminances sont valides
  if (isNaN(bgLuminance) || isNaN(fgLuminance)) {
    console.warn("ensureContrast: luminances invalides, retour de foreground");
    return foreground;
  }

  // Si le fond est clair, assombrir le texte
  // Si le fond est sombre, éclaircir le texte
  const targetLuminance = bgLuminance > 0.5
    ? bgLuminance - 0.3 // Assombrir pour fond clair
    : bgLuminance + 0.3; // Éclaircir pour fond sombre

  // Ajuster la couleur pour atteindre la luminosité cible
  const adjust = (c: number) => {
    if (isNaN(c)) return 0.1; // Valeur par défaut si NaN
    if (bgLuminance > 0.5) {
      // Assombrir
      return Math.max(0, Math.min(1, c * 0.3));
    } else {
      // Éclaircir
      return Math.max(0, Math.min(1, c + (1 - c) * 0.7));
    }
  };

  const r = adjust(foreground.red);
  const g = adjust(foreground.green);
  const b = adjust(foreground.blue);

  // Vérifier que les valeurs ajustées ne sont pas NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn("ensureContrast: valeurs ajustées invalides, retour de foreground");
    return foreground;
  }

  return rgb(r, g, b);
}

/**
 * Génère des variantes d'une couleur (plus claire ou plus foncée)
 */
function lighten(color: RGB, amount: number): RGB {
  // Valider que color est valide
  if (isNaN(color.red) || isNaN(color.green) || isNaN(color.blue)) {
    console.warn("lighten: couleur invalide, utilisation de la couleur par défaut");
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  const r = Math.min(1, Math.max(0, color.red + amount));
  const g = Math.min(1, Math.max(0, color.green + amount));
  const b = Math.min(1, Math.max(0, color.blue + amount));
  
  // Vérifier que les valeurs ne sont pas NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn("lighten: résultat NaN, utilisation de la couleur par défaut");
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  return rgb(r, g, b);
}

function darken(color: RGB, amount: number): RGB {
  // Valider que color est valide
  if (isNaN(color.red) || isNaN(color.green) || isNaN(color.blue)) {
    console.warn("darken: couleur invalide, utilisation de la couleur par défaut");
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  const r = Math.max(0, Math.min(1, color.red - amount));
  const g = Math.max(0, Math.min(1, color.green - amount));
  const b = Math.max(0, Math.min(1, color.blue - amount));
  
  // Vérifier que les valeurs ne sont pas NaN
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn("darken: résultat NaN, utilisation de la couleur par défaut");
    return rgb(0.49, 0.23, 0.93); // #7C3AED par défaut
  }
  
  return rgb(r, g, b);
}

/**
 * Génère les tokens de thème à partir des paramètres du garage
 */
export function getGarageTheme(garage: {
  theme_primary?: string | null;
  theme_accent?: string | null;
  theme_mode?: string | null;
  theme_surface?: string | null;
  theme_text?: string | null;
}): ThemeTokens {
  // Couleurs par défaut (violet premium)
  const defaultPrimary = "#7C3AED"; // Violet premium
  const defaultAccent = "#22C55E"; // Vert

  // Parser les couleurs hex avec validation stricte
  // Vérifier que theme_primary est une chaîne valide et non vide
  const primaryHexValue = garage.theme_primary;
  const primaryHex = (
    primaryHexValue &&
    typeof primaryHexValue === "string" &&
    primaryHexValue.trim() !== "" &&
    (primaryHexValue.startsWith("#") || /^[0-9A-Fa-f]{6}$/.test(primaryHexValue.replace("#", "")))
  ) ? primaryHexValue : defaultPrimary;
  
  // Vérifier que theme_accent est une chaîne valide et non vide
  const accentHexValue = garage.theme_accent;
  const accentHex = (
    accentHexValue &&
    typeof accentHexValue === "string" &&
    accentHexValue.trim() !== "" &&
    (accentHexValue.startsWith("#") || /^[0-9A-Fa-f]{6}$/.test(accentHexValue.replace("#", "")))
  ) ? accentHexValue : defaultAccent;

  // Convertir en RGB avec gestion d'erreur robuste
  let primary: RGB;
  let accent: RGB;
  
  try {
    primary = hexToRgb(primaryHex);
    // Vérifier que primary est valide (pas NaN)
    if (isNaN(primary.red) || isNaN(primary.green) || isNaN(primary.blue)) {
      throw new Error(`RGB invalide pour primary: r=${primary.red}, g=${primary.green}, b=${primary.blue}`);
    }
  } catch (error) {
    console.error("Erreur lors de la conversion de theme_primary:", error, "Valeur:", primaryHex);
    primary = hexToRgb(defaultPrimary);
  }
  
  try {
    accent = hexToRgb(accentHex);
    // Vérifier que accent est valide (pas NaN)
    if (isNaN(accent.red) || isNaN(accent.green) || isNaN(accent.blue)) {
      throw new Error(`RGB invalide pour accent: r=${accent.red}, g=${accent.green}, b=${accent.blue}`);
    }
  } catch (error) {
    console.error("Erreur lors de la conversion de theme_accent:", error, "Valeur:", accentHex);
    accent = hexToRgb(defaultAccent);
  }

  // Générer les variantes de primary
  const primary_50 = lighten(primary, 0.45);
  const primary_100 = lighten(primary, 0.35);
  const primary_600 = darken(primary, 0.1);
  const primary_700 = darken(primary, 0.2);
  const primary_900 = darken(primary, 0.4);

  // Générer les variantes d'accent
  const accent_50 = lighten(accent, 0.45);
  const accent_600 = darken(accent, 0.1);

  // Couleurs de base (toujours claires pour PDF imprimable)
  const bg = rgb(1, 1, 1); // Blanc pur pour fond
  const surface = rgb(0.98, 0.98, 0.98); // Gris très clair pour surfaces
  const border = rgb(0.85, 0.85, 0.85); // Gris clair pour bordures
  const zebra = rgb(0.97, 0.97, 0.97); // Gris très clair pour lignes zebra

  // Couleurs de texte (toujours sombres pour lisibilité sur fond clair)
  const text = rgb(0.1, 0.1, 0.1); // Presque noir
  const textSecondary = rgb(0.35, 0.35, 0.35); // Gris moyen
  const textMuted = rgb(0.5, 0.5, 0.5); // Gris clair

  // Couleurs sémantiques
  const danger = rgb(1, 0.3, 0.3); // Rouge
  const warning = rgb(0.96, 0.65, 0.14); // Orange
  const success = rgb(0.18, 0.8, 0.44); // Vert

  // Assurer le contraste pour les couleurs primaires sur fond blanc
  const primaryContrast = ensureContrast(primary, bg);
  const primary_700_contrast = ensureContrast(primary_700, bg);

  return {
    primary: primaryContrast,
    primary_50,
    primary_100,
    primary_600,
    primary_700: primary_700_contrast,
    primary_900,
    accent,
    accent_50,
    accent_600,
    bg,
    surface,
    border,
    text,
    textSecondary,
    textMuted,
    danger,
    warning,
    success,
    white: rgb(1, 1, 1),
    zebra,
  };
}
