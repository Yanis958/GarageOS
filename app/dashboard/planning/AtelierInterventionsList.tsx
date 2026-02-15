"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Phone, MessageSquare } from "lucide-react";
import type { TodayInterventionRow } from "@/lib/actions/planning";
import { toggleGarageTaskDone } from "@/lib/actions/garage-tasks";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<TodayInterventionRow["status"], string> = {
  a_faire: "À faire",
  en_retard: "En retard",
  termine: "Terminé",
};

export function AtelierInterventionsList({ interventions }: { interventions: TodayInterventionRow[] }) {
  const router = useRouter();

  async function handleMarkDone(row: TodayInterventionRow) {
    if (row.is_task && row.task_id) {
      const err = await toggleGarageTaskDone(row.task_id);
      if (err.error) toast.error(err.error);
      else {
        toast.success("Tâche marquée comme terminée.");
        router.refresh();
      }
    } else if (row.quote_id) {
      router.push(`/dashboard/devis/${row.quote_id}`);
    }
  }

  return (
    <ul className="space-y-3">
      {interventions.length === 0 ? (
        <li className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune intervention prévue aujourd&apos;hui. Renseignez la date prévue (RDV) sur vos devis acceptés ou ajoutez une tâche dans À faire.
        </li>
      ) : (
        interventions.map((row) => (
          <li
            key={row.id}
            className={cn(
              "flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors",
              row.status === "en_retard" && "border-destructive/50 bg-destructive/5"
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">
                  {row.vehicleLabel || row.reference || "—"}
                </span>
                {row.reference && row.vehicleLabel && (
                  <span className="text-sm text-muted-foreground">
                    {row.reference}
                  </span>
                )}
                <Badge
                  variant={row.status === "en_retard" ? "destructive" : row.status === "termine" ? "secondary" : "outline"}
                  className="shrink-0"
                >
                  {STATUS_LABEL[row.status]}
                </Badge>
                {!row.is_task && row.status === "a_faire" && !row.planned_at && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    À planifier
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-0 text-sm text-muted-foreground">
                {row.durationHours > 0 && (
                  <span>{row.durationHours}h estimées</span>
                )}
                {row.clientName && (
                  <span>Client : {row.clientName}</span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {row.is_task ? (
                row.status !== "termine" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-button gap-1.5"
                    onClick={() => handleMarkDone(row)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Terminé
                  </Button>
                )
              ) : (
                <Button variant="outline" size="sm" className="rounded-button" asChild>
                  <Link href={`/dashboard/devis/${row.quote_id}`}>Ouvrir le devis</Link>
                </Button>
              )}
              {row.clientPhone && (
                <Button variant="ghost" size="icon" className="rounded-button h-8 w-8" asChild>
                  <a href={`tel:${row.clientPhone.replace(/\s/g, "")}`} aria-label="Rappeler le client">
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              )}
              {row.quote_id && (
                <Button variant="ghost" size="icon" className="rounded-button h-8 w-8" asChild>
                  <Link href={`/dashboard/devis/${row.quote_id}#notes`} aria-label="Note rapide">
                    <MessageSquare className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </li>
        ))
      )}
    </ul>
  );
}
