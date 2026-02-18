import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getGaragesForAdmin, getAuditLogsForAdmin } from "@/lib/actions/admin";
import { Building2, ChevronRight, History, Mail, Settings } from "lucide-react";
import { InviteGenerator } from "@/components/dashboard/admin/InviteGenerator";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [garages, auditLogs] = await Promise.all([
    getGaragesForAdmin(),
    getAuditLogsForAdmin(50),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Admin — Garages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Liste des garages. Cliquez pour voir les paramètres, l’usage IA et les fonctionnalités.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Building2 className="h-5 w-5" />
            Garages ({garages.length})
          </CardTitle>
          <CardDescription>Accédez aux réglages et à l’usage de chaque garage</CardDescription>
        </CardHeader>
        <CardContent>
          {garages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun garage.</p>
          ) : (
            <ul className="divide-y divide-border">
              {garages.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/dashboard/admin/garages/${g.id}`}
                    className="flex items-center justify-between py-3 px-2 -mx-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <span className="font-medium text-foreground">
                        {g.name?.trim() || "Sans nom"}
                      </span>
                      {g.slug && (
                        <span className="ml-2 text-xs text-muted-foreground">/{g.slug}</span>
                      )}
                      {g.address?.trim() && (
                        <p className="text-sm text-muted-foreground mt-0.5">{g.address}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Mail className="h-5 w-5" />
              Invitations
            </CardTitle>
            <CardDescription>Gérer les liens d'invitation uniques</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/admin/invitations">
                Gérer les invitations
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Settings className="h-5 w-5" />
              Gestion des garages
            </CardTitle>
            <CardDescription>Activer/désactiver les garages</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard/admin/garages-management">
                Gérer les garages
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <InviteGenerator />

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            Dernières actions admin
          </CardTitle>
          <CardDescription>Logs d’audit des modifications (paramètres, feature flags)</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {auditLogs.slice(0, 20).map((log) => (
                <li key={log.id} className="flex flex-wrap gap-x-2 gap-y-0 py-1 border-b border-border last:border-0">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(log.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="font-medium">{log.action}</span>
                  {log.entity_type && <span className="text-muted-foreground">{log.entity_type}</span>}
                  {log.entity_id && <span className="text-muted-foreground truncate">{log.entity_id.slice(0, 8)}…</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
