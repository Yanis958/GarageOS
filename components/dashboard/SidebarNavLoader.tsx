"use client";

import dynamic from "next/dynamic";
import { SidebarNavFallback } from "./SidebarNavFallback";

const DynamicSidebarNav = dynamic(
  () => import("./SidebarNav").then((m) => ({ default: m.SidebarNav })),
  { ssr: false, loading: () => <SidebarNavFallback admin={false} /> }
);

/**
 * Charge SidebarNav uniquement côté client (ssr: false) pour éviter
 * "Cannot read properties of null (reading 'useContext')" avec Next 14.2.
 */
export function SidebarNavLoader({ admin }: { admin: boolean }) {
  return <DynamicSidebarNav admin={admin} />;
}
