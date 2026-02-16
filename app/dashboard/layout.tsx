import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageWithSettings } from "@/lib/actions/garage";
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

  const garageWithSettings = await getCurrentGarageWithSettings();
  if (!garageWithSettings) {
    redirect("/onboarding");
  }

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
