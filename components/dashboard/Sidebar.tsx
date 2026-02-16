import { Wrench } from "lucide-react";
import { getCurrentGarage } from "@/lib/actions/garage";
import { isAdmin } from "@/lib/actions/admin";
import { SidebarNavLoader } from "@/components/dashboard/SidebarNavLoader";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { createClient } from "@/lib/supabase/server";

export async function Sidebar() {
  const [garage, admin] = await Promise.all([getCurrentGarage(), isAdmin()]);
  const garageName = garage?.name?.trim() || "Garage";
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userEmail = user?.email || "";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[260px] flex-col border-r border-border bg-card shadow-sm">
      {/* Header avec logo */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#2563eb] text-white shadow-sm">
          <Wrench className="h-5 w-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-foreground" title={garageName}>
            {garageName}
          </span>
        </div>
      </div>

      {/* Navigation : Admin visible uniquement si isAdmin() (propriétaire plateforme, admin_users) */}
      <SidebarNavLoader admin={!!admin} />

      {/* Footer avec theme toggle et user */}
      <div className="border-t border-border px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <ThemeToggle />
        </div>
        {user && (
          <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
              <span className="text-xs font-semibold">
                {userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">
                {userEmail}
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
