"use client";

import Link from "next/link";

/**
 * Fallback statique sans usePathname, utilisé pendant le chargement de SidebarNav (ssr: false).
 * Évite "Cannot read properties of null (reading 'useContext')" avec Next 14.2.
 */
export function SidebarNavFallback({ admin }: { admin: boolean }) {
  const links = [
    { href: "/dashboard", label: "Tableau de bord" },
    { href: "/dashboard/devis", label: "Devis" },
    { href: "/dashboard/devis?status=accepted&facture_number=not_null", label: "Factures" },
    { href: "/dashboard/clients", label: "Clients" },
    { href: "/dashboard/vehicles", label: "Véhicules" },
    { href: "/dashboard/settings", label: "Paramètres" },
    ...(admin ? [{ href: "/dashboard/admin", label: "Admin" }] : []),
  ];
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
      <div className="flex flex-col gap-1">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
