import { getInsightsStats } from "@/lib/actions/insights";
import { DashboardCard, KPICard } from "@/components/dashboard/DashboardCard";
import { InsightsRecommendations } from "./InsightsRecommendations";
import { LineChart, Percent, ShoppingCart, Euro } from "lucide-react";

export default async function InsightsPage() {
  const stats = await getInsightsStats();

  const acceptanceValue =
    stats.acceptanceRate != null
      ? `${Math.round(stats.acceptanceRate * 100)} %`
      : "—";
  const acceptanceSubtext =
    stats.sentCount + stats.acceptedCount > 0
      ? `${stats.acceptedCount} acceptés / ${stats.acceptedCount + stats.sentCount} envoyés`
      : "Non calculable";

  const basketValue =
    stats.averageBasket != null
      ? `${stats.averageBasket.toFixed(2)} €`
      : "—";
  const basketSubtext =
    stats.acceptedCount > 0 ? `sur ${stats.acceptedCount} devis acceptés` : null;

  const estimatedCaValue = `${stats.estimatedCa.toFixed(2)} €`;
  const estimatedCaSubtext = "Devis en attente";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Analyse
        </h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <LineChart className="h-4 w-4" />
          Indicateurs et recommandations pour gagner plus
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <KPICard
            href="/dashboard/devis"
            accent="success"
            icon={Percent}
            label="Taux d'acceptation"
            value={acceptanceValue}
            subtext={acceptanceSubtext}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <KPICard
            href="/dashboard/devis?status=accepted"
            accent="quote"
            icon={ShoppingCart}
            label="Panier moyen"
            value={basketValue}
            subtext={basketSubtext}
          />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-4">
          <KPICard
            href="/dashboard/devis"
            accent="quote"
            icon={Euro}
            label="CA estimé"
            value={estimatedCaValue}
            subtext={estimatedCaSubtext}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <DashboardCard title="Recommandations">
            <InsightsRecommendations />
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
