"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionItem, ActionsDuJour } from "@/lib/actions/actions-du-jour";
import { markFacturePayee } from "@/lib/actions/actions-du-jour";
import { FileText, Calendar, CheckCircle, Send } from "lucide-react";

function formatAmount(amount: number | null): string {
  if (amount == null) return "";
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function ActionCard({ item }: { item: ActionItem }) {
  const router = useRouter();
  const devisHref = `/dashboard/devis/${item.quoteId}`;

  async function handleMarquerPayee() {
    const err = await markFacturePayee(item.quoteId);
    if (err?.error) {
      toast.error(err.error);
      return;
    }
    toast.success("Facture marquée payée.");
    router.refresh();
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{item.label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {item.detail && <span>{item.detail}</span>}
          {item.amount != null && item.amount > 0 && (
            <span className="font-medium text-foreground">{formatAmount(item.amount)}</span>
          )}
          {item.reference && (
            <span className="text-muted-foreground">Ref. {item.reference}</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {item.type === "relance_devis" && (
          <>
            <Button size="sm" variant="default" className="rounded-button" asChild>
              <Link href={devisHref}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Relancer
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="rounded-button" asChild>
              <Link href={`${devisHref}?planifier=1`}>
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                Proposer un créneau
              </Link>
            </Button>
            <Button size="sm" variant="ghost" className="rounded-button" asChild>
              <Link href={devisHref}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Voir le devis
              </Link>
            </Button>
          </>
        )}
        {item.type === "intervention" && (
          <>
            <Button size="sm" variant="default" className="rounded-button" asChild>
              <Link href={devisHref}>
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                Planifier maintenant
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="rounded-button" asChild>
              <Link href={devisHref}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Voir le devis
              </Link>
            </Button>
          </>
        )}
        {item.type === "facture" && (
          <>
            <Button size="sm" variant="outline" className="rounded-button" asChild>
              <Link href={devisHref}>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Envoyer rappel
              </Link>
            </Button>
            <Button
              size="sm"
              variant="default"
              className="rounded-button"
              onClick={handleMarquerPayee}
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              Marquer payée
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function Section({
  title,
  icon,
  items,
  emptyMessage,
}: {
  title: string;
  icon: React.ReactNode;
  items: ActionItem[];
  emptyMessage: string;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
        {items.length > 0 && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <ActionCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function ActionsDuJourList({ data }: { data: ActionsDuJour }) {
  const { summary, urgent, aujourdhui, aVenir } = data;

  return (
    <div className="space-y-8">
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground">
        {summary}
      </p>

      <Section
        title="Urgent"
        icon={<span className="text-red-600" aria-hidden>🔴</span>}
        items={urgent}
        emptyMessage="Aucune action urgente."
      />
      <Section
        title="Aujourd'hui"
        icon={<span className="text-amber-600" aria-hidden>🟡</span>}
        items={aujourdhui}
        emptyMessage="Rien de prévu pour aujourd'hui."
      />
      <Section
        title="À venir"
        icon={<span className="text-muted-foreground" aria-hidden>⚪</span>}
        items={aVenir}
        emptyMessage="Aucune action à venir."
      />
    </div>
  );
}
