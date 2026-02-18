"use client";

import { useGarage } from "@/components/providers/GarageProvider";
import { useEffect, useState } from "react";

export function TrialBadge() {
  const { garage } = useGarage();
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!garage || garage.is_active || !garage.trial_end_date) {
      return;
    }

    const calculateDaysRemaining = () => {
      const now = new Date();
      const trialEnd = new Date(garage.trial_end_date);
      const diffTime = trialEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysRemaining(Math.max(0, diffDays));
    };

    calculateDaysRemaining();
    // Recalculer toutes les heures pour mettre à jour le badge
    const interval = setInterval(calculateDaysRemaining, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [garage]);

  // Ne pas afficher si le garage est actif ou s'il n'y a pas de trial_end_date
  if (!garage || garage.is_active || !garage.trial_end_date || daysRemaining === null) {
    return null;
  }

  return (
    <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">
      Essai : {daysRemaining} jour{daysRemaining !== 1 ? "s" : ""} restant{daysRemaining !== 1 ? "s" : ""}
    </div>
  );
}
