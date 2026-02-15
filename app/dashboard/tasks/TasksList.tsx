"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { CheckSquare, Plus, Trash2, FileText } from "lucide-react";
import {
  createGarageTask,
  toggleGarageTaskDone,
  deleteGarageTask,
  type GarageTaskRow,
} from "@/lib/actions/garage-tasks";
import { cn } from "@/lib/utils";

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function TasksList({ initialTasks }: { initialTasks: GarageTaskRow[] }) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setLoading(true);
    const err = await createGarageTask({
      title,
      due_date: newDueDate.trim() || null,
    });
    setLoading(false);
    if (err.error) {
      toast.error(err.error);
      return;
    }
    setNewTitle("");
    setNewDueDate("");
    toast.success("Tâche ajoutée.");
    router.refresh();
    const next = await getGarageTasks();
    setTasks(next);
  }

  async function handleToggle(id: string) {
    setTogglingId(id);
    const err = await toggleGarageTaskDone(id);
    setTogglingId(null);
    if (err.error) {
      toast.error(err.error);
      return;
    }
    router.refresh();
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  async function handleDelete(id: string) {
    const err = await deleteGarageTask(id);
    if (err.error) {
      toast.error(err.error);
      return;
    }
    setTasks((prev) => prev.filter((t) => t.id !== id));
    toast.success("Tâche supprimée.");
    router.refresh();
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex-1 min-w-[200px] space-y-2">
          <Label htmlFor="task-title">Nouvelle tâche</Label>
          <Input
            id="task-title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ex. Rappeler M. Dupont, Commander pièce…"
            className="rounded-input"
            disabled={loading}
          />
        </div>
        <div className="w-36 space-y-2">
          <Label htmlFor="task-due">Échéance</Label>
          <Input
            id="task-due"
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="rounded-input"
            disabled={loading}
          />
        </div>
        <Button type="submit" size="sm" disabled={loading || !newTitle.trim()} className="rounded-button">
          <Plus className="h-4 w-4 mr-2" />
          Ajouter
        </Button>
      </form>

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">À faire ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border py-8 text-center">
            Aucune tâche en attente.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(t.id)}
                  disabled={togglingId === t.id}
                  className="shrink-0 rounded border border-border p-1 text-muted-foreground hover:bg-muted/50 hover:text-primary transition-colors"
                  aria-label="Marquer comme fait"
                >
                  <CheckSquare className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">{t.title}</span>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {t.due_date && <span>Échéance : {formatDate(t.due_date)}</span>}
                    {t.quote_id && (
                      <Link
                        href={`/dashboard/devis/${t.quote_id}`}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        Voir le devis
                      </Link>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(t.id)}
                  aria-label="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {done.length > 0 && (
          <>
            <h2 className="text-sm font-semibold text-muted-foreground pt-4">Terminées ({done.length})</h2>
            <ul className="space-y-2">
              {done.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleToggle(t.id)}
                    disabled={togglingId === t.id}
                    className="shrink-0 rounded border border-border bg-background p-1 text-success"
                    aria-label="Marquer non fait"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <span className={cn("text-sm", "line-through text-muted-foreground")}>{t.title}</span>
                    {t.due_date && (
                      <div className="text-xs text-muted-foreground mt-0.5">{formatDate(t.due_date)}</div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(t.id)}
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
