"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Car,
  Users,
  Settings,
  LineChart,
  CalendarDays,
  Shield,
  CheckSquare,
  Receipt,
} from "lucide-react";

type IconName = "dashboard" | "devis" | "planning" | "tasks" | "vehicles" | "clients" | "insights" | "settings" | "admin" | "factures";

const iconMap: Record<IconName, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  devis: FileText,
  factures: Receipt,
  planning: CalendarDays,
  tasks: CheckSquare,
  vehicles: Car,
  clients: Users,
  insights: LineChart,
  settings: Settings,
  admin: Shield,
};

interface NavLinkProps {
  href: string;
  icon: IconName;
  children: React.ReactNode;
}

export function NavLink({ href, icon, children }: NavLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pathOnly, queryString] = href.includes("?") ? href.split("?", 2) : [href, ""];
  const pathMatch = pathname === pathOnly || (pathOnly !== "/dashboard" && pathname.startsWith(pathOnly));
  const queryMatch = !queryString || (() => {
    const params = new URLSearchParams(queryString);
    for (const [k, v] of Array.from(params.entries())) {
      if (searchParams.get(k) !== v) return false;
    }
    return true;
  })();
  const isActive = pathMatch && queryMatch;
  const Icon = iconMap[icon];

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-primary/10 text-primary font-semibold shadow-sm"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {children}
    </Link>
  );
}
