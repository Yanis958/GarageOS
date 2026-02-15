/**
 * Enveloppe sécurisée pour les appels IA : timeout, retry, mesure de latence, mapping d'erreurs.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 1;

function timeoutPromise<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("Timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function toReadableMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Timeout") return "Délai dépassé. Réessayez.";
    if (e.message.includes("ECONNREFUSED") || e.message.includes("fetch")) return "Service temporairement indisponible.";
    if (e.message.includes("429") || e.message.includes("rate")) return "Trop de requêtes. Réessayez plus tard.";
    if (e.message.includes("401") || e.message.includes("403")) return "Accès refusé au service IA.";
    return "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
  }
  return "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
}

export type SafeAiCallOptions<T> = {
  garageId: string;
  userId?: string;
  feature: string;
  fn: () => Promise<T>;
  timeoutMs?: number;
  maxRetries?: number;
};

export type SafeAiCallResult<T> =
  | { data: T; error?: undefined; latencyMs: number }
  | { data?: undefined; error: string; latencyMs: number };

/**
 * Exécute fn avec timeout, au plus 1 retry en cas d'échec, mesure la latence.
 * Retourne { data, latencyMs } en succès, { error, latencyMs } en échec (message lisible, pas de stack).
 */
export async function safeAiCall<T>(options: SafeAiCallOptions<T>): Promise<SafeAiCallResult<T>> {
  const { garageId: _g, userId: _u, feature: _f, fn, timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = DEFAULT_MAX_RETRIES } = options;
  const start = Date.now();
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await timeoutPromise(fn(), timeoutMs);
      const latencyMs = Date.now() - start;
      return { data: result, latencyMs };
    } catch (e) {
      lastError = e;
    }
  }
  const latencyMs = Date.now() - start;
  return { error: toReadableMessage(lastError), latencyMs };
}
