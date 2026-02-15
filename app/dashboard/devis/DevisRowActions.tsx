"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Copy } from "lucide-react";
import { duplicateQuoteAction } from "@/lib/actions/quotes";

export function DevisRowActions({ quoteId }: { quoteId: string }) {
  const router = useRouter();

  async function handleDuplicate() {
    const id = await duplicateQuoteAction(quoteId);
    if (id) router.push(`/dashboard/devis/${id}`);
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/dashboard/devis/${quoteId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Ouvrir"
      >
        <FileText className="h-4 w-4" />
      </Link>
      <button
        type="button"
        onClick={handleDuplicate}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Dupliquer"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
}
