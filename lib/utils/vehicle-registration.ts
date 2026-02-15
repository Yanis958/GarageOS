/** Format français : 2 lettres, 3 chiffres, 2 lettres → AB-123-CD */
const FRENCH_PLATE_REGEX = /^[A-Z]{2}-[0-9]{3}-[A-Z]{2}$/;

export function normalizeFrenchRegistration(raw: string): string {
  const clean = raw.replace(/[\s-]/g, "").toUpperCase();
  if (clean.length === 7 && /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(clean)) {
    return `${clean.slice(0, 2)}-${clean.slice(2, 5)}-${clean.slice(5)}`;
  }
  return clean;
}

export function isValidFrenchPlate(normalized: string): boolean {
  return FRENCH_PLATE_REGEX.test(normalized);
}
