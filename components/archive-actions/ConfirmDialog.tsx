"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Variant = "archive" | "restore" | "delete" | "decline";

const CONFIG: Record<
  Variant,
  { title: string; description: string; confirmLabel: string; confirmVariant: "default" | "destructive" }
> = {
  archive: {
    title: "Archiver",
    description: "Masquer de l'application, réversible.",
    confirmLabel: "Archiver",
    confirmVariant: "default",
  },
  restore: {
    title: "Restaurer",
    description: "Réafficher dans l'application.",
    confirmLabel: "Restaurer",
    confirmVariant: "default",
  },
  delete: {
    title: "Supprimer définitivement",
    description: "Irréversible.",
    confirmLabel: "Supprimer définitivement",
    confirmVariant: "destructive",
  },
  decline: {
    title: "Marquer le devis comme refusé",
    description: "Le client aura refusé ce devis. Vous pourrez le consulter dans l'historique.",
    confirmLabel: "Marquer refusé",
    confirmVariant: "destructive",
  },
};

export function ConfirmDialog({
  variant,
  open,
  onOpenChange,
  onConfirm,
  loading,
}: {
  variant: Variant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}) {
  const config = CONFIG[variant];

  async function handleConfirm() {
    await onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={!loading}>
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annuler
          </Button>
          <Button variant={config.confirmVariant} onClick={handleConfirm} disabled={loading}>
            {loading ? "..." : config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
