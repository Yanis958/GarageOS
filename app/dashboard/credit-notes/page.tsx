import Link from "next/link";
import { getCreditNotes } from "@/lib/actions/credit-notes";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, DataTableColumn } from "@/components/dashboard/DataTable";

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyé" },
  { value: "accepted", label: "Accepté" },
];

export default async function CreditNotesPage({
  searchParams,
}: {
  searchParams: Promise<{
    archived?: string;
  }>;
}) {
  const params = await searchParams;
  const showArchived = params.archived === "1";

  const creditNotes = await getCreditNotes(showArchived);

  const columns: DataTableColumn<typeof creditNotes[0]>[] = [
    {
      key: "reference",
      header: "Référence",
      render: (cn) => (
        <Link
          href={`/dashboard/credit-notes/${cn.id}`}
          className="font-semibold text-primary hover:underline"
        >
          {cn.reference}
        </Link>
      ),
      sortable: true,
    },
    {
      key: "client",
      header: "Client",
      render: (cn) => {
        const clientName =
          cn.clients && typeof cn.clients === "object" && "name" in cn.clients
            ? (cn.clients as { name: string | null }).name ?? "—"
            : "—";
        return <span className="text-muted-foreground">{clientName}</span>;
      },
    },
    {
      key: "status",
      header: "Statut",
      render: (cn) => <StatusBadge status={cn.status} />,
    },
    {
      key: "total_ttc",
      header: "Montant TTC",
      render: (cn) => {
        const amount = Number(cn.total_ttc) || 0;
        return (
          <span className="font-medium">
            {new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency: "EUR",
            }).format(amount)}
          </span>
        );
      },
      sortable: true,
    },
    {
      key: "issued_at",
      header: "Date d'émission",
      render: (cn) => {
        if (!cn.issued_at) return "—";
        return new Date(cn.issued_at).toLocaleDateString("fr-FR");
      },
      sortable: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Avoirs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestion des avoirs (notes de crédit)
          </p>
        </div>
      </div>

      <DataTable
        data={creditNotes}
        columns={columns}
        searchPlaceholder="Rechercher un avoir..."
        emptyMessage="Aucun avoir trouvé."
      />
    </div>
  );
}
