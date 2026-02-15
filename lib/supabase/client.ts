import { createBrowserClient } from "@supabase/ssr";

/** Placeholder utilisés uniquement au build quand les env vars ne sont pas encore injectées (ex. Vercel). En runtime les vraies variables doivent être définies. */
const BUILD_PLACEHOLDER_URL = "https://placeholder.supabase.co";
const BUILD_PLACEHOLDER_KEY = "placeholder-anon-key";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? BUILD_PLACEHOLDER_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? BUILD_PLACEHOLDER_KEY;
  return createBrowserClient(url, key);
}
