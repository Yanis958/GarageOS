/**
 * Rate limit centralisé pour les routes IA (par garage).
 * Fenêtre glissante en mémoire ; X requêtes par minute.
 */

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Vérifie et consomme une requête pour le garage.
 * @returns true si la requête est autorisée, false si limite atteinte.
 */
export function checkRateLimit(garageId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(garageId);
  if (!entry) {
    rateLimitMap.set(garageId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    rateLimitMap.set(garageId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}
