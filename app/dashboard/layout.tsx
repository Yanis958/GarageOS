import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageWithSettings } from "@/lib/actions/garage";
import { isAdmin } from "@/lib/actions/admin";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { CopilotWidget } from "@/components/dashboard/CopilotWidget";
import { GarageProvider } from "@/components/providers/GarageProvider";
import { GarageThemeProvider } from "@/components/providers/GarageThemeProvider";
import { DashboardHydrationShell } from "@/components/dashboard/DashboardHydrationShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // IMPORTANT : Les admins contournent complètement la vérification du trial
  // Un admin ne doit jamais être redirigé vers /trial-expire
  const admin = await isAdmin();
  
  const garageWithSettings = await getCurrentGarageWithSettings();
  if (!garageWithSettings) {
    redirect("/onboarding");
  }

  // Vérifier si le trial est expiré UNIQUEMENT pour les utilisateurs non-admin
  // Ne rediriger vers /trial-expire QUE si :
  // 1. L'utilisateur n'est PAS admin
  // 2. ET le garage n'est pas actif (is_active = false)
  // 3. ET il a une date de fin de trial définie (non NULL)
  // 4. ET cette date est dans le passé (trial expiré)
  if (!admin) {
    const garage = garageWithSettings.garage;
    if (!garage.is_active && garage.trial_end_date) {
      try {
        const now = new Date();
        const trialEnd = new Date(garage.trial_end_date);
        
        // Vérifier que la date est valide
        if (isNaN(trialEnd.getTime())) {
          // Date invalide, ne pas rediriger
          console.error("Date de fin de trial invalide:", garage.trial_end_date);
        } else {
          // Rediriger uniquement si le trial est vraiment expiré (date passée)
          if (trialEnd.getTime() < now.getTime()) {
            redirect("/trial-expire");
          }
        }
      } catch (error) {
        // Si erreur de parsing de date, ne pas rediriger (éviter les boucles)
        console.error("Erreur lors de la vérification du trial:", error);
      }
    }
  }
  
  // Si is_active = false mais pas de trial_end_date, permettre l'accès
  // (cas des garages existants avant l'implémentation du système de trial)

  return (
    <DashboardHydrationShell>
      <GarageProvider initialGarage={garageWithSettings}>
        <GarageThemeProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex flex-1 flex-col ml-[260px]">
              <Topbar />
              <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
            <CopilotWidget garageName={garageWithSettings.garage.name?.trim() || null} />
          </div>
        </GarageThemeProvider>
      </GarageProvider>
    </DashboardHydrationShell>
  );
}
