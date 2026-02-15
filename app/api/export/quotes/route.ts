import { NextRequest, NextResponse } from "next/server";
import { exportQuotesCsv, type QuoteListFilters } from "@/lib/actions/quotes";
import { toCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Construire les filtres depuis les query params
    const filters: QuoteListFilters = {};
    const status = searchParams.get("status");
    if (status) filters.status = status;
    const q = searchParams.get("q");
    if (q) filters.q = q;
    const period = searchParams.get("period");
    if (period && ["all", "this_month", "last_30"].includes(period)) {
      filters.period = period as "all" | "this_month" | "last_30";
    }
    const expired = searchParams.get("expired");
    if (expired === "1") filters.expired = true;
    const toRelance = searchParams.get("toRelance");
    if (toRelance === "1") filters.toRelance = true;
    const archived = searchParams.get("archived");
    if (archived === "1") filters.archived = true;
    const factureNumber = searchParams.get("facture_number");
    if (factureNumber === "not_null") filters.facture_number = "not_null";

    const includeItems = searchParams.get("includeItems") === "1";

    // Récupérer les données
    const result = await exportQuotesCsv(filters, includeItems);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Convertir en CSV
    const headers = includeItems
      ? ["quote_reference", "item_type", "description", "qty", "unit_price_ht", "total_ht"]
      : [
          "reference",
          "statut",
          "date_creation",
          "valide_jusquau",
          "client_nom",
          "client_email",
          "vehicule",
          "total_ht",
          "tva",
          "total_ttc",
          "nb_lignes",
          "notes_client",
          "notes_internes",
        ];

    const rows = result.data.map((row) => {
      if (includeItems) {
        const itemRow = row as {
          quote_reference: string;
          item_type: string;
          description: string;
          qty: number;
          unit_price_ht: number;
          total_ht: number;
        };
        return [
          itemRow.quote_reference,
          itemRow.item_type,
          itemRow.description,
          String(itemRow.qty),
          String(itemRow.unit_price_ht),
          String(itemRow.total_ht),
        ];
      } else {
        const quoteRow = row as {
          reference: string;
          statut: string;
          date_creation: string;
          valide_jusquau: string;
          client_nom: string;
          client_email: string;
          vehicule: string;
          total_ht: number;
          tva: number;
          total_ttc: number;
          nb_lignes: number;
          notes_client: string;
          notes_internes: string;
        };
        return [
          quoteRow.reference,
          quoteRow.statut,
          quoteRow.date_creation,
          quoteRow.valide_jusquau,
          quoteRow.client_nom,
          quoteRow.client_email,
          quoteRow.vehicule,
          String(quoteRow.total_ht),
          String(quoteRow.tva),
          String(quoteRow.total_ttc),
          String(quoteRow.nb_lignes),
          quoteRow.notes_client,
          quoteRow.notes_internes,
        ];
      }
    });

    const csvContent = toCsv([headers, ...rows]);

    // Générer le nom de fichier avec date
    const today = new Date().toISOString().slice(0, 10);
    const filename = includeItems ? `devis_lignes_${today}.csv` : `devis_${today}.csv`;

    // Retourner le CSV avec les bons headers
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Erreur export CSV devis:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de l'export CSV" }, { status: 500 });
  }
}
