"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function FixDataButton() {
  const [loading, setLoading] = useState(false);

  async function handleFix() {
    setLoading(true);
    try {
      const res = await fetch("/api/fix-data", {
        method: "POST",
      });
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || "Données corrigées avec succès");
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.error(data.error || "Erreur lors de la correction");
      }
    } catch (error) {
      toast.error("Erreur lors de la correction des données");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleFix} disabled={loading} variant="outline">
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Correction en cours..." : "Corriger les données"}
    </Button>
  );
}
