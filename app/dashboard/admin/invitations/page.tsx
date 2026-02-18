"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Copy, Check, Plus } from "lucide-react";

type Invitation = {
  id: string;
  token: string;
  garage_name: string;
  used: boolean;
  used_at: string | null;
  created_at: string;
  created_by: string | null;
};

export default function AdminInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [garageName, setGarageName] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  async function loadInvitations() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invitations");
      if (!res.ok) {
        throw new Error("Erreur lors du chargement");
      }
      const data = await res.json();
      setInvitations(data);
    } catch (error) {
      toast.error("Erreur lors du chargement des invitations");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (!garageName.trim()) {
      toast.error("Le nom du garage est requis");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ garageName: garageName.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Invitation créée avec succès");
        setGarageName("");
        await loadInvitations();
      }
    } catch (error) {
      toast.error("Erreur lors de la création de l'invitation");
    } finally {
      setCreating(false);
    }
  }

  function copyInvitationLink(token: string) {
    const url = `${window.location.origin}/invitation/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    toast.success("Lien copié dans le presse-papiers");
    setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Invitations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Générez des liens d'invitation uniques pour créer de nouveaux garages.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Plus className="h-5 w-5" />
            Générer un lien d'invitation
          </CardTitle>
          <CardDescription>Créez un lien unique pour inviter un nouveau garage</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateInvitation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="garage_name">Nom du garage</Label>
              <Input
                id="garage_name"
                value={garageName}
                onChange={(e) => setGarageName(e.target.value)}
                placeholder="Ex: Garage Martin"
                required
              />
            </div>
            <Button type="submit" disabled={creating} className="bg-primary text-primary-foreground">
              {creating ? "Création..." : "Générer le lien"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Mail className="h-5 w-5" />
            Liste des invitations ({invitations.length})
          </CardTitle>
          <CardDescription>Toutes les invitations générées</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement...</p>
          ) : invitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune invitation.</p>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => {
                const invitationUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/invitation/${inv.token}`;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{inv.garage_name}</span>
                        {inv.used ? (
                          <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                            ✅ Utilisée
                          </span>
                        ) : (
                          <span className="text-xs bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full">
                            ⏳ En attente
                          </span>
                        )}
                      </div>
                      {inv.used && inv.used_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Utilisée le {new Date(inv.used_at).toLocaleDateString("fr-FR")}
                        </p>
                      )}
                      {!inv.used && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono break-all">
                          {invitationUrl}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Créée le {new Date(inv.created_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    {!inv.used && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyInvitationLink(inv.token)}
                        className="ml-4 shrink-0"
                      >
                        {copiedToken === inv.token ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
