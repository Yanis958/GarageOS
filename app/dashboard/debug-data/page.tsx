"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "@/lib/actions/garage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FixDataButton } from "./FixDataButton";

export default async function DebugDataPage() {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  
  // Récupérer tous les clients (sans filtre garage_id pour diagnostic)
  const { data: allClients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, garage_id, created_at, archived_at")
    .order("created_at", { ascending: false })
    .limit(50);
  
  // Récupérer tous les véhicules (sans filtre garage_id pour diagnostic)
  const { data: allVehicles, error: vehiclesError } = await supabase
    .from("vehicles")
    .select("id, registration, garage_id, client_id, created_at, archived_at")
    .order("created_at", { ascending: false })
    .limit(50);
  
  // Récupérer les garages
  const { data: garages, error: garagesError } = await supabase
    .from("garages")
    .select("id, name")
    .limit(10);
  
  // Récupérer garage_members
  const { data: { user } } = await supabase.auth.getUser();
  const { data: members, error: membersError } = user
    ? await supabase
        .from("garage_members")
        .select("garage_id, user_id, role")
        .eq("user_id", user.id)
    : { data: null, error: null };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Diagnostic des données</h1>
        <FixDataButton />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Informations de session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p><strong>User ID:</strong> {user?.id || "Non connecté"}</p>
          <p><strong>Garage ID actuel:</strong> {garageId || "❌ Aucun garage trouvé"}</p>
          <p><strong>Garages disponibles:</strong> {garages?.length || 0}</p>
          <p><strong>Membres garage:</strong> {members?.length || 0}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Clients ({allClients?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {clientsError ? (
            <p className="text-destructive">Erreur: {clientsError.message}</p>
          ) : (
            <div className="space-y-2">
              {allClients && allClients.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Nom</th>
                      <th className="text-left p-2">Garage ID</th>
                      <th className="text-left p-2">Match?</th>
                      <th className="text-left p-2">Créé le</th>
                      <th className="text-left p-2">Archivé?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allClients.map((c) => (
                      <tr key={c.id} className="border-b">
                        <td className="p-2">{c.name || "—"}</td>
                        <td className="p-2">{c.garage_id || "❌ NULL"}</td>
                        <td className="p-2">
                          {c.garage_id === garageId ? "✅" : "❌"}
                        </td>
                        <td className="p-2">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="p-2">{c.archived_at ? "Oui" : "Non"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Aucun client trouvé.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Véhicules ({allVehicles?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {vehiclesError ? (
            <p className="text-destructive">Erreur: {vehiclesError.message}</p>
          ) : (
            <div className="space-y-2">
              {allVehicles && allVehicles.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Immatriculation</th>
                      <th className="text-left p-2">Garage ID</th>
                      <th className="text-left p-2">Match?</th>
                      <th className="text-left p-2">Créé le</th>
                      <th className="text-left p-2">Archivé?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allVehicles.map((v) => (
                      <tr key={v.id} className="border-b">
                        <td className="p-2">{v.registration || "—"}</td>
                        <td className="p-2">{v.garage_id || "❌ NULL"}</td>
                        <td className="p-2">
                          {v.garage_id === garageId ? "✅" : "❌"}
                        </td>
                        <td className="p-2">{new Date(v.created_at).toLocaleDateString()}</td>
                        <td className="p-2">{v.archived_at ? "Oui" : "Non"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Aucun véhicule trouvé.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Garages</CardTitle>
        </CardHeader>
        <CardContent>
          {garagesError ? (
            <p className="text-destructive">Erreur: {garagesError.message}</p>
          ) : (
            <div className="space-y-2">
              {garages && garages.length > 0 ? (
                <ul>
                  {garages.map((g) => (
                    <li key={g.id}>
                      <strong>{g.name || "Sans nom"}</strong> (ID: {g.id})
                      {g.id === garageId && " ← Garage actuel"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Aucun garage trouvé.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
