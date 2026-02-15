"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCreditNoteForPdf } from "@/lib/actions/credit-notes";
import { generateDevisPdf } from "@/lib/pdf-devis/generate";

export function CreditNotePdfButton({ creditNoteId }: { creditNoteId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDownloadPdf() {
    setLoading(true);
    try {
      const { payload, error } = await getCreditNoteForPdf(creditNoteId);
      if (error || !payload) {
        toast.error(error || "Erreur lors de la récupération des données de l'avoir.");
        return;
      }

      const bytes = await generateDevisPdf(payload);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avoir-${payload.creditNoteNumber?.replace(/\s/g, "-") || creditNoteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF téléchargé.");
    } catch (e) {
      console.error(e);
      toast.error("Erreur lors de la génération du PDF.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleDownloadPdf} disabled={loading} variant="outline">
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Génération...
        </>
      ) : (
        <>
          <FileDown className="mr-2 h-4 w-4" />
          Télécharger PDF
        </>
      )}
    </Button>
  );
}
