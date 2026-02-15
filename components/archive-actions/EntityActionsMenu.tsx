"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { archiveClient, restoreClient, hardDeleteClient } from "@/lib/actions/clients";
import { archiveVehicle, restoreVehicle, hardDeleteVehicle } from "@/lib/actions/vehicles";
import { archiveDevis, restoreDevis, hardDeleteDevis } from "@/lib/actions/quotes";

export type EntityType = "client" | "vehicle" | "devis";

type Props = {
  entityType: EntityType;
  entityId: string;
  isArchived: boolean;
  listUrl: string;
  /** Si on est sur la page détail, rediriger vers la liste après suppression définitive */
  redirectToListAfterDelete?: boolean;
  /** Masquer "Supprimer définitivement" (ex. véhicules : privilégier l'archivage) */
  hideHardDelete?: boolean;
};

const ARCHIVE_ACTIONS = {
  client: { archive: archiveClient, restore: restoreClient, hardDelete: hardDeleteClient },
  vehicle: { archive: archiveVehicle, restore: restoreVehicle, hardDelete: hardDeleteVehicle },
  devis: { archive: archiveDevis, restore: restoreDevis, hardDelete: hardDeleteDevis },
};

const ENTITY_LABELS: Record<EntityType, string> = {
  client: "Client",
  vehicle: "Véhicule",
  devis: "Devis",
};

export function EntityActionsMenu({
  entityType,
  entityId,
  isArchived,
  listUrl,
  redirectToListAfterDelete = false,
  hideHardDelete = false,
}: Props) {
  const router = useRouter();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const actions = ARCHIVE_ACTIONS[entityType];
  const label = ENTITY_LABELS[entityType];

  async function handleArchive() {
    setLoading(true);
    try {
      const res = await actions.archive(entityId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isArchived ? `${label} restauré.` : `${label} archivé.`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    try {
      const res = await actions.restore(entityId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label} restauré.`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleHardDelete() {
    setLoading(true);
    try {
      const res = await actions.hardDelete(entityId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${label} supprimé définitivement.`);
      if (redirectToListAfterDelete) {
        router.push(listUrl);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isArchived ? (
            <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Restaurer
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
              <Archive className="mr-2 h-4 w-4" />
              Archiver
            </DropdownMenuItem>
          )}
          {!hideHardDelete && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer définitivement
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        variant={isArchived ? "restore" : "archive"}
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        onConfirm={isArchived ? handleRestore : handleArchive}
        loading={loading}
      />
      <ConfirmDialog
        variant="delete"
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleHardDelete}
        loading={loading}
      />
    </>
  );
}
