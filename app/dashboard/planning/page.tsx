import { getTodayInterventions } from "@/lib/actions/planning";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { AtelierInterventionsList } from "./AtelierInterventionsList";

function formatTodayHeader(): string {
  const d = new Date();
  const weekday = d.toLocaleDateString("fr-FR", { weekday: "long" });
  const day = d.getDate();
  const month = d.toLocaleDateString("fr-FR", { month: "long" });
  return `Aujourd'hui – ${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day} ${month}`;
}

export const dynamic = "force-dynamic";

export default async function PlanningPage() {
  const interventions = await getTodayInterventions();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {formatTodayHeader()}
        </h1>
        <p className="text-sm text-muted-foreground">
          Interventions et véhicules prévus aujourd&apos;hui à l&apos;atelier.
        </p>
      </div>

      <DashboardCard title="Liste des interventions">
        <AtelierInterventionsList interventions={interventions} />
      </DashboardCard>
    </div>
  );
}
