import { getActionsDuJour } from "@/lib/actions/actions-du-jour";
import { ActionsDuJourList } from "./ActionsDuJourList";

export const dynamic = "force-dynamic";

export default async function ActionsDuJourPage() {
  const data = await getActionsDuJour();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Actions du jour
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Qu’est-ce que je dois faire maintenant pour ne rien oublier et faire rentrer de l’argent ?
        </p>
      </div>
      <ActionsDuJourList data={data} />
    </div>
  );
}
