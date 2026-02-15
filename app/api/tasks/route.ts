import { NextResponse } from "next/server";
import { getCurrentGarageId } from "@/lib/actions/garage";
import { getTodayTasksWithPriority } from "@/lib/actions/quotes";

export async function GET() {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const limit = 5;
    const tasks = await getTodayTasksWithPriority(limit);
    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("[api/tasks] Error:", e);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des tâches" },
      { status: 500 }
    );
  }
}
