import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { getCreditNoteById, getCreditNoteForPdf } from "@/lib/actions/credit-notes";
import { generateDevisPdf } from "@/lib/pdf-devis/generate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CreditNotePdfButton } from "./CreditNotePdfButton";

export default async function CreditNoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creditNote = await getCreditNoteById(id);

  if (!creditNote) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/credit-notes"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux avoirs
        </Link>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Avoir non trouvé.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const client = creditNote.clients as {
    id: string;
    name: string | null;
  } | null;

  const vehicle = creditNote.vehicles as {
    id: string;
    brand?: string | null;
    model?: string | null;
    registration?: string | null;
  } | null;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/credit-notes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux avoirs
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Avoir {creditNote.reference}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {client?.name ?? "Client inconnu"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={creditNote.status} />
          <CreditNotePdfButton creditNoteId={id} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Référence
              </p>
              <p className="text-foreground">{creditNote.reference}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Date d'émission
              </p>
              <p className="text-foreground">
                {creditNote.issued_at
                  ? new Date(creditNote.issued_at).toLocaleDateString("fr-FR")
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Client
              </p>
              <p className="text-foreground">{client?.name ?? "—"}</p>
            </div>
            {vehicle && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Véhicule
                </p>
                <p className="text-foreground">
                  {[vehicle.brand, vehicle.model]
                    .filter(Boolean)
                    .join(" ") || vehicle.registration || "—"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totaux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-medium">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(Number(creditNote.total_ht) || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVA</span>
              <span className="font-medium">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(Number(creditNote.total_tva) || 0)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-4">
              <span className="font-semibold text-foreground">Total TTC</span>
              <span className="font-bold text-lg">
                {new Intl.NumberFormat("fr-FR", {
                  style: "currency",
                  currency: "EUR",
                }).format(Number(creditNote.total_ttc) || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {creditNote.notes_client && (
        <Card>
          <CardHeader>
            <CardTitle>Notes client</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {creditNote.notes_client}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
