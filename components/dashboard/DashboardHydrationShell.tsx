"use client";

import { useState, useEffect } from "react";

/**
 * Affiche les enfants uniquement après le premier montage client.
 * Évite les erreurs d'hydratation en garantissant un premier rendu
 * identique (skeleton) côté serveur et client, puis le contenu réel.
 */
export function DashboardHydrationShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="w-[260px] shrink-0 border-r border-border bg-card/50 animate-pulse" />
        <div className="flex-1 flex flex-col ml-[260px]">
          <div className="h-16 border-b border-border bg-card/50 animate-pulse" />
          <main className="flex-1 p-6">
            <div className="h-8 w-48 rounded bg-muted/50 animate-pulse" />
            <div className="mt-6 h-32 rounded bg-muted/30 animate-pulse" />
          </main>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
