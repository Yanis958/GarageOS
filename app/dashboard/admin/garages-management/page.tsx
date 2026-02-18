"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

type Garage = {
  id: string;
  name: string | null;
  trial_end_date: string | null;
  is_active: boolean;
  created_at: string;
};

async function getGaragesForManagement(): Promise<Garage[]> {
  const res = await fetch("/api/admin/garages-management");
  if (!res.ok) return [];
  return res.json();
}

async function activateGarage(garageId: string): Promise<{ error?: string }> {
  const res = await fetch("/api/admin/garages-management/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ garageId }),
  });
  return res.json();
}

async function deactivateGarage(garageId: string): Promise<{ error?: string }> {
  const res = await fetch("/api/admin/garages-management/deactivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ garageId }),
  });
  return res.json();
}

export default function GaragesManagementPage() {
  const [trialGarages, setTrialGarages] = useState<Garage[]>([]);
  const [activeGarages, setActiveGarages] = useState<Garage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  useEffect(() => {
    loadGarages();
  }, []);

  async function loadGarages() {
    setLoading(true);
    try {
      const garages = await getGaragesForManagement();
      setTrialGarages(garages.filter((g) => !g.is_active));
      setActiveGarages(garages.filter((g) => g.is_active));
    } catch (error) {
      toast.error("Erreur lors du chargement des garages");
    } finally {
      setLoading(false);
    }
  }

  async function handleActivate(garageId: string) {
    setActivating(garageId);
    try {
      const result = await activateGarage(garageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Garage activé avec succès");
        await loadGarages();
      }
    } catch (error) {
      toast.error("Erreur lors de l'activation");
    } finally {
      setActivating(null);
    }
  }

  async function handleDeactivate(garageId: string) {
    setDeactivating(garageId);
    try {
      const result = await deactivateGarage(garageId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Garage désactivé");
        await loadGarages();
      }
    } catch (error) {
      toast.error("Erreur lors de la désactivation");
    } finally {
      setDeactivating(null);
    }
  }

  function calculateDaysRemaining(trialEndDate: string | null): number | null {
    if (!trialEndDate) return null;
    const now = new Date();
    const trialEnd = new Date(trialEndDate);
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  function isTrialExpired(trialEndDate: string | null): boolean {
    if (!trialEndDate) return false;
    return new Date() > new Date(trialEndDate);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Gestion des garages
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez les garages en essai et les garages actifs.
        </p>
      </div>

      {/* Section 1 : Garages en trial */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Garages en essai ({trialGarages.length})
          </CardTitle>
          <CardDescription>Garages avec is_active = false</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : trialGarages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun garage en essai.</p>
          ) : (
            <div className="space-y-3">
              {trialGarages.map((garage) => {
                const daysRemaining = calculateDaysRemaining(garage.trial_end_date);
                const expired = isTrialExpired(garage.trial_end_date);
                return (
                  <div
                    key={garage.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {garage.name || "Sans nom"}
                        </span>
                        {expired ? (
                          <Badge variant="destructive">Expiré</Badge>
                        ) : daysRemaining !== null ? (
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            {daysRemaining} jour{daysRemaining !== 1 ? "s" : ""} restant{daysRemaining !== 1 ? "s" : ""}
                          </Badge>
                        ) : null}
                      </div>
                      {garage.trial_end_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Fin de l'essai : {new Date(garage.trial_end_date).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Créé le {new Date(garage.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleActivate(garage.id)}
                      disabled={activating === garage.id}
                      size="sm"
                      className="ml-4 bg-primary text-primary-foreground"
                    >
                      {activating === garage.id ? "Activation..." : "Activer"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 : Garages actifs */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Garages actifs ({activeGarages.length})
          </CardTitle>
          <CardDescription>Garages avec is_active = true (payés)</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : activeGarages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun garage actif.</p>
          ) : (
            <div className="space-y-3">
              {activeGarages.map((garage) => {
                // Trouver la date d'activation (première fois où is_active est passé à true)
                // Pour simplifier, on utilise created_at comme approximation
                return (
                  <div
                    key={garage.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {garage.name || "Sans nom"}
                        </span>
                        <Badge variant="outline" className="text-green-500 border-green-500">
                          Actif
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Créé le {new Date(garage.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleDeactivate(garage.id)}
                      disabled={deactivating === garage.id}
                      size="sm"
                      variant="outline"
                      className="ml-4"
                    >
                      {deactivating === garage.id ? "Désactivation..." : "Désactiver"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
