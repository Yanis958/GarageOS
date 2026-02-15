"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Copy, Loader2, Check } from "lucide-react";

export function InviteGenerator() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreateInvite() {
    if (!email || !email.includes("@")) {
      toast.error("Veuillez entrer un email valide");
      return;
    }

    setLoading(true);
    setInviteLink(null);
    setCopied(false);

    try {
      const response = await fetch("/api/invites/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Erreur lors de la création de l'invitation");
        return;
      }

      if (data.invite?.invite_url) {
        setInviteLink(data.invite.invite_url);
        toast.success("Invitation créée avec succès");
      } else {
        toast.error("Réponse invalide du serveur");
      }
    } catch (error) {
      console.error("Erreur création invite:", error);
      toast.error("Erreur lors de la création de l'invitation");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Lien copié dans le presse-papiers");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Erreur copie:", error);
      toast.error("Impossible de copier le lien");
    }
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Mail className="h-5 w-5" />
          Créer une invitation
        </CardTitle>
        <CardDescription>
          Générez un lien d'invitation pour permettre à un utilisateur de créer un compte
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email de l'invité</Label>
          <div className="flex gap-2">
            <Input
              id="invite-email"
              type="email"
              placeholder="exemple@garage.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleCreateInvite();
                }
              }}
              disabled={loading}
              className="flex-1"
            />
            <Button
              onClick={handleCreateInvite}
              disabled={loading || !email}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </div>
        </div>

        {inviteLink && (
          <div className="space-y-2">
            <Label>Lien d'invitation</Label>
            <div className="flex gap-2">
              <Input
                value={inviteLink}
                readOnly
                className="flex-1 font-mono text-sm"
              />
              <Button
                onClick={handleCopyLink}
                variant="outline"
                size="icon"
                title="Copier le lien"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Copiez ce lien et envoyez-le à l'invité. Le lien expire dans 30 jours.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
