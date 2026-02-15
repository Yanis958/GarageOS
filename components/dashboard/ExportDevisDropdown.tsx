"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadTextFile } from "@/lib/download";

type ExportDevisDropdownProps = {
  filters?: {
    q?: string;
    status?: string;
    period?: string;
    expired?: boolean;
    toRelance?: boolean;
    archived?: boolean;
    facture_number?: string;
  };
};

export function ExportDevisDropdown({ filters }: ExportDevisDropdownProps) {
  const [loading, setLoading] = useState(false);

  const buildExportUrl = (includeItems: boolean, customPeriod?: string) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.q) params.set("q", filters.q);
    if (customPeriod) {
      params.set("period", customPeriod);
    } else if (filters?.period) {
      params.set("period", filters.period);
    }
    if (filters?.expired) params.set("expired", "1");
    if (filters?.toRelance) params.set("toRelance", "1");
    if (filters?.archived) params.set("archived", "1");
    if (filters?.facture_number) params.set("facture_number", filters.facture_number);
    if (includeItems) params.set("includeItems", "1");
    return `/api/export/quotes?${params.toString()}`;
  };

  const handleExport = async (url: string) => {
    setLoading(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'export");
      }
      const csvContent = await response.text();
      const today = new Date().toISOString().slice(0, 10);
      const filename = url.includes("includeItems=1") ? `devis_lignes_${today}.csv` : `devis_${today}.csv`;
      downloadTextFile(filename, csvContent);
      toast.success("CSV téléchargé avec succès");
    } catch (error: any) {
      console.error("Erreur export CSV:", error);
      toast.error(error.message || "Erreur lors du téléchargement du CSV");
    } finally {
      setLoading(false);
    }
  };

  const hasActiveFilters = !!(filters?.q || filters?.status || filters?.period || filters?.expired || filters?.toRelance);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Export...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Exporter CSV
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport(buildExportUrl(false))} disabled={loading}>
          Exporter tous les devis
        </DropdownMenuItem>
        {hasActiveFilters && (
          <DropdownMenuItem onClick={() => handleExport(buildExportUrl(false))} disabled={loading}>
            Exporter les devis filtrés
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => handleExport(buildExportUrl(false, "this_month"))} disabled={loading}>
          Exporter devis du mois
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport(buildExportUrl(true))} disabled={loading}>
          Exporter avec lignes (détaillé)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
