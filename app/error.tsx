"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Error({
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
    <div className="dark flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 bg-background px-4 text-foreground">
      <h2 className="text-lg font-semibold">Une erreur est survenue</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {error.message || "Erreur inattendue. Réessaie ou retourne à l&apos;accueil."}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="secondary" className="rounded-button">
          Réessayer
        </Button>
        <Button asChild className="rounded-button">
          <Link href="/">Accueil</Link>
        </Button>
      </div>
    </div>
  );
}
