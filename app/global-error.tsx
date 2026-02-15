"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fafafa", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Une erreur est survenue</h2>
        <p style={{ color: "#a1a1aa", marginTop: "0.5rem", textAlign: "center" }}>
          {error.message || "Erreur inattendue."}
        </p>
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: "0.5rem 1rem", borderRadius: "6px", background: "#27272a", color: "#fafafa", border: "none", cursor: "pointer", fontSize: "0.875rem" }}
          >
            Réessayer
          </button>
          <a
            href="/"
            style={{ padding: "0.5rem 1rem", borderRadius: "6px", background: "#7c3aed", color: "#fff", textDecoration: "none", fontSize: "0.875rem" }}
          >
            Accueil
          </a>
        </div>
      </body>
    </html>
  );
}
