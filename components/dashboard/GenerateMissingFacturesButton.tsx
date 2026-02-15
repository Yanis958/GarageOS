"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { generateMissingFactureNumbers } from "@/lib/actions/quotes";

export function GenerateMissingFacturesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const result = await generateMissingFactureNumbers();
      if (result.error) {
        toast.error(`Erreur : ${result.error}`);
      } else if (result.count === 0) {
        toast.info("Tous les devis acceptés ont déjà un numéro de facture.");
      } else {
        toast.success(`${result.count} numéro${result.count > 1 ? "s" : ""} de facture généré${result.count > 1 ? "s" : ""}.`);
        router.refresh();
      }
    } catch (error) {
      console.error("Erreur génération factures:", error);
      toast.error("Erreur lors de la génération des numéros de facture.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={loading}
      variant="outline"
      size="sm"
      className="rounded-button"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4 mr-2" />
          Générer les numéros manquants
        </>
      )}
    </Button>
  );
}
