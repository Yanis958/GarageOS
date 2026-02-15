"use client";

import { createContext, useContext, useMemo } from "react";
import type { GarageWithSettings } from "@/lib/garage/types";

type GarageContextValue = {
  garage: GarageWithSettings["garage"] | null;
  settings: GarageWithSettings["settings"];
  garageId: string | null;
  /** Taux horaire par défaut (€), fallback 60 */
  hourlyRate: number;
  /** Taux de TVA (0–100), fallback 20 */
  vatRate: number;
  /** Taux de TVA en décimal pour calculs (0.2), fallback 0.2 */
  vatRateDecimal: number;
  /** Validité devis en jours, fallback 30 */
  quoteValidDays: number;
};

const GarageContext = createContext<GarageContextValue | null>(null);

export function GarageProvider({
  initialGarage,
  children,
}: {
  initialGarage: GarageWithSettings | null;
  children: React.ReactNode;
}) {
  const value = useMemo<GarageContextValue>(() => {
    const garage = initialGarage?.garage ?? null;
    const settings = initialGarage?.settings ?? null;
    return {
      garage,
      settings,
      garageId: garage?.id ?? null,
      hourlyRate: settings?.hourly_rate ?? 60,
      vatRate: settings?.vat_rate ?? 20,
      vatRateDecimal: (settings?.vat_rate ?? 20) / 100,
      quoteValidDays: settings?.quote_valid_days ?? 30,
    };
  }, [initialGarage]);

  return <GarageContext.Provider value={value}>{children}</GarageContext.Provider>;
}

export function useGarage(): GarageContextValue {
  const ctx = useContext(GarageContext);
  if (!ctx) {
    throw new Error("useGarage must be used within GarageProvider");
  }
  return ctx;
}

export function useGarageSettings() {
  const { settings, hourlyRate, vatRate, vatRateDecimal, quoteValidDays } = useGarage();
  return {
    settings,
    hourlyRate,
    vatRate,
    vatRateDecimal,
    quoteValidDays,
  };
}
