"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createQuoteFromSuggestedLines } from "@/lib/actions/quotes";
import { createQuickTask, toggleQuickTaskDone, type QuickTaskRow } from "@/lib/actions/quick-tasks";
import type { QuickNoteSuggestResponse, SuggestedQuoteLine } from "@/lib/ai/quick-note-types";
import { Mic, MicOff, Sparkles, FileText, CheckSquare, Loader2 } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  labor: "Main-d'œuvre",
  part: "Pièce",
  forfait: "Forfait",
};

export function QuickNoteBlock({
  entityType,
  entityId,
  clientId,
  vehicleId,
  tasks: initialTasks,
}: {
  entityType: "client" | "vehicle";
  entityId: string;
  clientId: string;
  vehicleId?: string | null;
  tasks: QuickTaskRow[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<QuickNoteSuggestResponse | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const hasSpeech =
    typeof window !== "undefined" &&
    (!!(window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      !!(window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition);

  const startSpeech = useCallback(() => {
    if (typeof window === "undefined") return;
    const SR = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR() as {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onresult: (e: { resultIndex: number; results: Record<number, { transcript: string }> & { isFinal?: boolean; length: number } }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "fr-FR";
    rec.onresult = (e) => {
      const last = e.resultIndex;
      const result = e.results[last] as unknown as (Record<number, { transcript: string }> & { isFinal?: boolean; length: number }) | undefined;
      if (!result) return;
      const isFinal = result.isFinal !== false;
      const text = isFinal && result[0] ? result[0].transcript : Array.from({ length: result.length }, (_, i) => result[i]?.transcript ?? "").join("");
      if (isFinal && text) setNote((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
    };
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  }, []);

  const stopSpeech = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const FALLBACK_MSG = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";

  async function handleSuggest() {
    if (!note.trim()) return;
    setError(null);
    setSuggestion(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/quick-note/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim(), entityType, entityId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.fallback === true || data.error) {
        setError(typeof data.error === "string" ? data.error : FALLBACK_MSG);
        return;
      }
      if (!res.ok) {
        if (res.status === 429) {
          setError("Trop de requêtes. Réessayez dans une minute.");
          return;
        }
        setError(typeof data.error === "string" ? data.error : FALLBACK_MSG);
        return;
      }
      setSuggestion(data);
    } catch {
      setError(FALLBACK_MSG);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateQuote(lines: SuggestedQuoteLine[]) {
    setCreatingQuote(true);
    setError(null);
    try {
      const result = await createQuoteFromSuggestedLines(clientId, vehicleId ?? null, lines);
      if (result?.error) setError(result.error);
    } finally {
      setCreatingQuote(false);
    }
  }

  async function handleCreateTask(title: string) {
    setCreatingTask(true);
    setError(null);
    try {
      const result = await createQuickTask(entityType, entityId, title);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setSuggestion(null);
      router.refresh();
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleToggleDone(id: string) {
    await toggleQuickTaskDone(id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="quick-note" className="text-sm font-medium text-foreground">
          Note
        </label>
        <div className="flex gap-2">
          <Textarea
            id="quick-note"
            placeholder="Note rapide ou dictée…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[80px] resize-y"
          />
          {hasSpeech ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 rounded-button"
              onClick={isRecording ? stopSpeech : startSpeech}
              title={isRecording ? "Arrêter la dictée" : "Dictée vocale"}
            >
              <Mic className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" variant="outline" size="icon" className="shrink-0 rounded-button" disabled title="Dictée non disponible dans ce navigateur">
              <MicOff className="h-4 w-4 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>
      <Button
        type="button"
        onClick={handleSuggest}
        disabled={!note.trim() || loading}
        className="rounded-button bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        Obtenir une suggestion
      </Button>
      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive space-y-2">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="rounded-button" onClick={() => void handleSuggest()}>
            Réessayer
          </Button>
        </div>
      )}
      {suggestion && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
          {suggestion.kind === "quote_lines" ? (
            <>
              <p className="text-sm font-semibold text-foreground">Lignes de devis suggérées</p>
              <ul className="text-sm space-y-1.5">
                {suggestion.lines.map((l, i) => (
                  <li key={i} className="flex flex-wrap gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{l.description}</span>
                    <span>{l.quantity} × {l.unit_price.toFixed(2)} €</span>
                    <span>{TYPE_LABEL[l.type] ?? l.type}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => handleCreateQuote(suggestion.lines)}
                  disabled={creatingQuote}
                  className="rounded-button bg-primary text-primary-foreground"
                >
                  {creatingQuote ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Créer un devis avec ces lignes
                </Button>
                <Button type="button" variant="outline" onClick={() => setSuggestion(null)} className="rounded-button">
                  Annuler
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Tâche suggérée</p>
              <p className="text-sm text-muted-foreground">{suggestion.title}</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => handleCreateTask(suggestion.title)}
                  disabled={creatingTask}
                  className="rounded-button bg-primary text-primary-foreground"
                >
                  {creatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="mr-2 h-4 w-4" />}
                  Créer la tâche
                </Button>
                <Button type="button" variant="outline" onClick={() => setSuggestion(null)} className="rounded-button">
                  Annuler
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      {initialTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Tâches à faire</p>
          <ul className="space-y-1.5">
            {initialTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => handleToggleDone(t.id)}
                  className="flex items-center gap-2 rounded border border-border bg-background px-2 py-1.5 text-left hover:bg-muted/50 w-full"
                  aria-checked={t.done}
                >
                  <span className={`shrink-0 ${t.done ? "text-success line-through" : "text-foreground"}`}>
                    {t.done ? "✓" : "○"}
                  </span>
                  <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
