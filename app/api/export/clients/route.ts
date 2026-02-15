import { NextResponse } from "next/server";
import { exportClientsCsv } from "@/lib/actions/clients";
import { toCsv } from "@/lib/csv";

export async function GET() {
  try {
    // Récupérer les données
    const result = await exportClientsCsv();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Convertir en CSV
    const headers = ["nom", "email", "telephone", "adresse", "nb_vehicules", "nb_devis", "total_facture", "created_at"];

    const rows = result.data.map((row) => [
      row.nom,
      row.email,
      row.telephone,
      row.adresse,
      String(row.nb_vehicules),
      String(row.nb_devis),
      String(row.total_facture),
      row.created_at,
    ]);

    const csvContent = toCsv([headers, ...rows]);

    // Générer le nom de fichier avec date
    const today = new Date().toISOString().slice(0, 10);
    const filename = `clients_${today}.csv`;

    // Retourner le CSV avec les bons headers
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Erreur export CSV clients:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de l'export CSV" }, { status: 500 });
  }
}
