import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isAdmin();
  if (!ok) redirect("/dashboard");
  return <>{children}</>;
}
