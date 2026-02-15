"use server";

import { getClients } from "./clients";
import { getVehicles } from "./vehicles";

export type SearchSuggestion = 
  | { type: "client"; id: string; name: string; href: string }
  | { type: "vehicle"; id: string; registration: string; brand?: string | null; model?: string | null; clientName?: string | null; href: string };

export async function searchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const term = query.trim();
  const [clients, vehicles] = await Promise.all([
    getClients(term, false),
    getVehicles(term, false),
  ]);

  const suggestions: SearchSuggestion[] = [];

  // Ajouter les clients (limite 5)
  for (const client of clients.slice(0, 5)) {
    if (client.name) {
      suggestions.push({
        type: "client",
        id: client.id,
        name: client.name,
        href: `/dashboard/clients/${client.id}`,
      });
    }
  }

  // Ajouter les véhicules (limite 5)
  for (const vehicle of vehicles.slice(0, 5)) {
    if (vehicle.registration) {
      const clientName =
        vehicle.clients && typeof vehicle.clients === "object" && "name" in vehicle.clients
          ? (vehicle.clients as { name: string | null }).name
          : null;

      suggestions.push({
        type: "vehicle",
        id: vehicle.id,
        registration: vehicle.registration,
        brand: vehicle.brand,
        model: vehicle.model,
        clientName,
        href: `/dashboard/vehicles/${vehicle.id}`,
      });
    }
  }

  return suggestions;
}
