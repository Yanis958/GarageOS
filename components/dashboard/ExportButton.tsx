"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadTextFile } from "@/lib/download";

type ExportButtonProps = {
  endpoint: string;
  filename: string;
  label?: string;
};

export function ExportButton({ endpoint, filename, label = "Exporter CSV" }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'export");
      }
      const csvContent = await response.text();
      const today = new Date().toISOString().slice(0, 10);
      const finalFilename = filename.replace("{date}", today);
      downloadTextFile(finalFilename, csvContent);
      toast.success("CSV téléchargé avec succès");
    } catch (error: any) {
      console.error("Erreur export CSV:", error);
      toast.error(error.message || "Erreur lors du téléchargement du CSV");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Export...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          {label}
        </>
      )}
    </Button>
  );
}
