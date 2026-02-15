"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, Send, Loader2, RotateCcw } from "lucide-react";
import type { CopilotAction } from "@/lib/ai/copilot-types";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: CopilotAction[];
  isError?: boolean;
};

/** Fallback si aucun nom de garage. */
const COPILOT_TITLE_FALLBACK = "Copilote du garage";

/** 6 suggestions stratégiques : décision business, pas de surcharge. */
const SUGGESTIONS = [
  "🔥 Quels devis risquent d'être perdus ?",
  "💰 Quel devis prioriser pour maximiser le CA ?",
  "⏳ Quels clients relancer en priorité ?",
  "📈 Comment améliorer mon taux de conversion ?",
  "📊 Pourquoi mon CA est faible ce mois-ci ?",
  "⚡ Résume mes actions urgentes aujourd'hui",
];

export function CopilotWidget({ garageName = null }: { garageName?: string | null }) {
  const copilotTitle = garageName?.trim() ? `Copilote de ${garageName.trim()}` : COPILOT_TITLE_FALLBACK;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    try {
      const history = messages
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const data = await res.json();
      const fallbackMsg = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
      if (data.fallback === true || data.error) {
        const msg = typeof data.error === "string" ? data.error : fallbackMsg;
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: msg, isError: true },
        ]);
        return;
      }
      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: typeof data.error === "string" ? data.error : fallbackMsg, isError: true },
        ]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer ?? "",
          actions: Array.isArray(data.actions) ? data.actions : [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.", isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full h-14 w-14 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 p-0 md:h-12 md:w-auto md:rounded-button md:px-4 md:gap-2"
        aria-label="Ouvrir le copilote"
      >
        <MessageCircle className="h-6 w-6 md:h-5 md:w-5" />
        <span className="hidden md:inline">Copilote</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="p-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between gap-2">
              <div>
                <SheetTitle>{copilotTitle}</SheetTitle>
                <SheetDescription>
                  Assistant stratégique. Analyse, priorise et recommande des actions business concrètes.
                </SheetDescription>
              </div>
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setMessages([])}
                  aria-label="Nouvelle conversation"
                  title="Nouvelle conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {messages.length === 0 && (
              <div className="p-4 space-y-2">
                <p className="text-sm text-muted-foreground">Choisissez une question :</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="rounded-button border border-border bg-muted/50 px-3 py-2 text-xs text-foreground hover:bg-muted transition-all duration-200 text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="p-4 space-y-4 flex-1">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : msg.isError
                          ? "bg-destructive/10 border border-destructive/30 text-destructive"
                          : "bg-muted border border-border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && !msg.isError && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.actions.map((a, j) => (
                          <Link
                            key={j}
                            href={a.href}
                            className="inline-flex items-center rounded-button bg-primary/90 text-primary-foreground px-2.5 py-1.5 text-xs font-medium hover:bg-primary transition-all duration-200"
                            onClick={() => setOpen(false)}
                          >
                            {a.label}
                          </Link>
                        ))}
                      </div>
                    )}
                    {msg.role === "assistant" && msg.isError && i === messages.length - 1 && i > 0 && messages[i - 1].role === "user" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 rounded-button"
                        onClick={() => sendMessage(messages[i - 1].content)}
                      >
                        Réessayer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-lg px-3 py-2 bg-muted border border-border">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-border flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre question..."
              className="min-h-[44px] max-h-32 resize-none rounded-input"
              rows={1}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0 rounded-button h-11 w-11"
              disabled={loading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
