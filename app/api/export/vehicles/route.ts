import { NextResponse } from "next/server";
import { exportVehiclesCsv } from "@/lib/actions/vehicles";
import { toCsv } from "@/lib/csv";

export async function GET() {
  try {
    // Récupérer les données
    const result = await exportVehiclesCsv();

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Convertir en CSV
    const headers = ["immatriculation", "marque", "modele", "annee", "client", "nb_devis", "created_at"];

    const rows = result.data.map((row) => [
      row.immatriculation,
      row.marque,
      row.modele,
      row.annee,
      row.client,
      String(row.nb_devis),
      row.created_at,
    ]);

    const csvContent = toCsv([headers, ...rows]);

    // Générer le nom de fichier avec date
    const today = new Date().toISOString().slice(0, 10);
    const filename = `vehicules_${today}.csv`;

    // Retourner le CSV avec les bons headers
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Erreur export CSV véhicules:", error);
    return NextResponse.json({ error: error.message || "Erreur lors de l'export CSV" }, { status: 500 });
  }
}
