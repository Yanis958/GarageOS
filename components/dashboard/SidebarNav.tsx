"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NavLink } from "@/components/dashboard/NavLink";

/**
 * Wrapper client qui n’affiche les NavLink (usePathname) qu’après hydratation,
 * pour éviter "Cannot read properties of null (reading 'useContext')" avec Next 14.2
 * quand un Server Component rend directement des composants utilisant next/navigation.
 */
export function SidebarNav({ admin }: { admin: boolean }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
        <div className="flex flex-col gap-1">
          {[
            { href: "/dashboard", label: "Tableau de bord" },
            { href: "/dashboard/devis", label: "Devis" },
            { href: "/dashboard/devis?status=accepted&facture_number=not_null", label: "Factures" },
            { href: "/dashboard/clients", label: "Clients" },
            { href: "/dashboard/vehicles", label: "Véhicules" },
            { href: "/dashboard/settings", label: "Paramètres" },
            ...(admin ? [{ href: "/dashboard/admin", label: "Admin" }] : []),
          ].map(({ href, label }) => (
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

  return (
    <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
      <NavLink href="/dashboard" icon="dashboard">
        Tableau de bord
      </NavLink>
      <NavLink href="/dashboard/devis" icon="devis">
        Devis
      </NavLink>
      <NavLink href="/dashboard/devis?status=accepted&facture_number=not_null" icon="factures">
        Factures
      </NavLink>
      <NavLink href="/dashboard/clients" icon="clients">
        Clients
      </NavLink>
      <NavLink href="/dashboard/vehicles" icon="vehicles">
        Véhicules
      </NavLink>
      <NavLink href="/dashboard/settings" icon="settings">
        Paramètres
      </NavLink>
      {admin && (
        <NavLink href="/dashboard/admin" icon="admin">
          Admin
        </NavLink>
      )}
    </nav>
  );
}
