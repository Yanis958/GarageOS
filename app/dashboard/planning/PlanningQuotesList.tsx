"use client";

import { useState } from "react";
import { PlanningSuggest } from "./PlanningSuggest";
import type { AcceptedQuoteWithDuration } from "@/lib/actions/planning";
import { Button } from "@/components/ui/button";
import { CalendarClock } from "lucide-react";
import Link from "next/link";

export function PlanningQuotesList({
  quotes,
  assignedQuoteIds,
  weekStart,
  weekDays,
}: {
  quotes: AcceptedQuoteWithDuration[];
  assignedQuoteIds: string[];
  weekStart: string;
  weekDays: string[];
}) {
  const [selectedQuote, setSelectedQuote] = useState<AcceptedQuoteWithDuration | null>(null);
  const assignedSet = new Set(assignedQuoteIds);
  const withoutSlot = quotes.filter((q) => !assignedSet.has(q.id));

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Devis acceptés (sans créneau cette semaine)</h3>
      {withoutSlot.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun devis accepté à placer ou tous sont déjà affectés.</p>
      ) : (
        <ul className="space-y-2">
          {withoutSlot.map((quote) => (
            <li
              key={quote.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <Link href={`/dashboard/devis/${quote.id}`} className="font-semibold text-primary hover:underline">
                  {quote.reference ?? `#${quote.id.slice(0, 8)}`}
                </Link>
                {quote.clientName && <span className="text-muted-foreground"> · {quote.clientName}</span>}
                <span className="text-muted-foreground"> · {quote.durationHours}h</span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-button shrink-0"
                onClick={() => setSelectedQuote(quote)}
              >
                <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                Proposer un créneau
              </Button>
            </li>
          ))}
        </ul>
      )}
      {selectedQuote && (
        <div className="rounded-lg border border-border bg-card p-4">
          <PlanningSuggest
            quote={selectedQuote}
            weekStart={weekStart}
            weekDays={weekDays}
            onClose={() => setSelectedQuote(null)}
          />
        </div>
      )}
    </div>
  );
}
