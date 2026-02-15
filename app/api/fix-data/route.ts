import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "@/lib/actions/garage";

export async function POST() {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) {
      return NextResponse.json(
        { error: "Aucun garage trouvé. Veuillez d'abord créer un garage." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    // Mettre à jour les clients sans garage_id
    const { data: clientsWithoutGarage, error: clientsError } = await supabase
      .from("clients")
      .select("id")
      .is("garage_id", null)
      .limit(1000);
    
    if (clientsError) {
      console.error("Erreur récupération clients:", clientsError);
    } else if (clientsWithoutGarage && clientsWithoutGarage.length > 0) {
      const { error: updateClientsError } = await supabase
        .from("clients")
        .update({ garage_id: garageId })
        .in("id", clientsWithoutGarage.map((c) => c.id));
      
      if (updateClientsError) {
        console.error("Erreur mise à jour clients:", updateClientsError);
      } else {
        console.log(`✅ ${clientsWithoutGarage.length} clients mis à jour`);
      }
    }
    
    // Mettre à jour les véhicules sans garage_id
    const { data: vehiclesWithoutGarage, error: vehiclesError } = await supabase
      .from("vehicles")
      .select("id")
      .is("garage_id", null)
      .limit(1000);
    
    if (vehiclesError) {
      console.error("Erreur récupération véhicules:", vehiclesError);
    } else if (vehiclesWithoutGarage && vehiclesWithoutGarage.length > 0) {
      const { error: updateVehiclesError } = await supabase
        .from("vehicles")
        .update({ garage_id: garageId })
        .in("id", vehiclesWithoutGarage.map((v) => v.id));
      
      if (updateVehiclesError) {
        console.error("Erreur mise à jour véhicules:", updateVehiclesError);
      } else {
        console.log(`✅ ${vehiclesWithoutGarage.length} véhicules mis à jour`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Données corrigées. Clients: ${clientsWithoutGarage?.length || 0}, Véhicules: ${vehiclesWithoutGarage?.length || 0}`,
    });
  } catch (error) {
    console.error("Erreur fix-data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
