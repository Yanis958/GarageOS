import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import {
  getGarageWithSettingsForAdmin,
  getAiUsageForAdmin,
  getFeatureFlagsForAdmin,
} from "@/lib/actions/admin";
import { AdminGarageSettingsForm } from "./AdminGarageSettingsForm";
import { AdminFeatureFlags } from "./AdminFeatureFlags";

export const dynamic = "force-dynamic";

export default async function AdminGarageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: garageId } = await params;
  const [data, usageRows] = await Promise.all([
    getGarageWithSettingsForAdmin(garageId),
    getAiUsageForAdmin(12),
  ]);

  if (!data) notFound();

  const usageForThisGarage = usageRows
    .filter((r) => r.garage_id === garageId)
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 12);
  const totalUsage = usageForThisGarage.reduce((s, r) => s + (r.request_count ?? 0), 0);

  const flags = await getFeatureFlagsForAdmin(garageId);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {data.garage.name?.trim() || "Sans nom"}
        </h1>
        {data.garage.slug && (
          <p className="text-sm text-muted-foreground">/{data.garage.slug}</p>
        )}
        {data.garage.address?.trim() && (
          <p className="text-sm text-muted-foreground">{data.garage.address}</p>
        )}
      </div>

      <AdminGarageSettingsForm garageId={garageId} initialSettings={data.settings} />

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Usage IA (requêtes / mois)</CardTitle>
          <CardDescription>Nombre de requêtes IA pour ce garage par mois</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Total (12 derniers mois) : <strong>{totalUsage}</strong> requêtes
          </p>
          {usageForThisGarage.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune donnée pour l’instant.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {usageForThisGarage.map((r) => (
                <li key={r.period} className="flex justify-between">
                  <span className="text-muted-foreground">{r.period}</span>
                  <span>{r.request_count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AdminFeatureFlags garageId={garageId} initialFlags={flags} />
    </div>
  );
}
