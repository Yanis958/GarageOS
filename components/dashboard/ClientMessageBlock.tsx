"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClientMessageDrawer, type ClientMessageContext } from "@/components/dashboard/ClientMessageDrawer";
import { MessageSquare } from "lucide-react";

export type ClientMessageBlockClient = {
  name: string | null;
  email?: string | null;
  phone?: string | null;
};

export type ClientMessageBlockQuote = {
  reference?: string | null;
  total_ttc?: number | null;
  valid_until?: string | null;
  vehicles?: { registration?: string | null; brand?: string | null; model?: string | null } | null;
} | null;

export function ClientMessageBlock({
  client,
  lastQuote,
}: {
  client: ClientMessageBlockClient;
  lastQuote: ClientMessageBlockQuote;
}) {
  const [open, setOpen] = useState(false);

  const context: ClientMessageContext = {
    clientName: client.name ?? "",
    vehicleLabel: lastQuote?.vehicles
      ? (() => {
          const v = lastQuote.vehicles;
          if (!v) return undefined;
          const brandModel = [v.brand, v.model].filter(Boolean).join(" ").trim();
          return brandModel || (v.registration ?? undefined);
        })()
      : undefined,
    quoteRef: lastQuote?.reference ?? undefined,
    totalTtc: lastQuote?.total_ttc != null ? Number(lastQuote.total_ttc) : undefined,
    validUntil: lastQuote?.valid_until ?? null,
  };

  return (
    <>
      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-sm font-medium text-foreground">Message client (SMS / Email)</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-button"
            onClick={() => setOpen(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Générer message
          </Button>
        </CardContent>
      </Card>
      <ClientMessageDrawer
        open={open}
        onOpenChange={setOpen}
        context={context}
        clientEmail={client.email}
        clientPhone={client.phone}
      />
    </>
  );
}
