"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreClient } from "@/lib/actions/clients";
import { restoreVehicle } from "@/lib/actions/vehicles";
import { restoreDevis } from "@/lib/actions/quotes";
import type { EntityType } from "./EntityActionsMenu";

const RESTORE_ACTIONS: Record<EntityType, (id: string) => Promise<{ error?: string }>> = {
  client: restoreClient,
  vehicle: restoreVehicle,
  devis: restoreDevis,
};

const LABELS: Record<EntityType, string> = {
  client: "client",
  vehicle: "véhicule",
  devis: "devis",
};

export function ArchivedBanner({
  entityType,
  entityId,
}: {
  entityType: EntityType;
  entityId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const restore = RESTORE_ACTIONS[entityType];
  const label = LABELS[entityType];

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await restore(entityId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} restauré.`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
      <span className="text-muted-foreground">Cet élément est archivé.</span>
      <Button variant="outline" size="sm" onClick={handleRestore} disabled={loading}>
        <ArchiveRestore className="mr-2 h-4 w-4" />
        {loading ? "..." : "Restaurer"}
      </Button>
    </div>
  );
}
