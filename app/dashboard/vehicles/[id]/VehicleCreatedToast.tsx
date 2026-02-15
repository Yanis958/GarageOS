"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function VehicleCreatedToast({ show }: { show: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!show) return;
    toast.success("Véhicule créé avec succès.");
    router.replace(window.location.pathname, { scroll: false });
  }, [show, router]);

  return null;
}
