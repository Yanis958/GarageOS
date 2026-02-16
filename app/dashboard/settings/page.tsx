import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";
import { getCurrentGarageWithSettings } from "@/lib/actions/garage";
import { SettingsGarageForm } from "./SettingsGarageForm";
import { GarageAppearanceSettings } from "@/components/dashboard/GarageAppearanceSettings";
import { PriceMemorySettings } from "@/components/dashboard/PriceMemorySettings";
import { LogoutButton } from "@/components/dashboard/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const garageWithSettings = await getCurrentGarageWithSettings();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Paramètres du garage
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuration de ton garage et préférences.
        </p>
      </div>

      <SettingsGarageForm garageWithSettings={garageWithSettings} />

      {garageWithSettings && (
        <PriceMemorySettings
          garageId={garageWithSettings.garage.id}
          settings={garageWithSettings.settings}
        />
      )}

      {garageWithSettings && (
        <GarageAppearanceSettings
          garageId={garageWithSettings.garage.id}
          settings={garageWithSettings.settings}
        />
      )}

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <User className="h-5 w-5" />
            Compte
          </CardTitle>
          <CardDescription>Informations de connexion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={userEmail} placeholder="email@exemple.com" className="max-w-md" readOnly />
          </div>
          <p className="text-xs text-muted-foreground">
            Pour modifier ton mot de passe, utilise la réinitialisation depuis la page de connexion.
          </p>
          <div className="pt-2 border-t border-border">
            <LogoutButton />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
