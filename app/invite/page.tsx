"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Mail, Lock, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function getTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("token");
}

function InvitePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const tokenFromRouter = searchParams.get("token");

  const [token, setToken] = useState<string | null>(null);
  const [urlChecked, setUrlChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<{
    email: string;
    garage_id: string | null;
  } | null>(null);

  // Safari: useSearchParams() peut ne pas être prêt — lire le token depuis l'URL au montage
  useEffect(() => {
    const fromUrl = getTokenFromUrl();
    const resolved = tokenFromRouter ?? fromUrl;
    if (resolved) setToken(resolved);
    setUrlChecked(true);
  }, [tokenFromRouter]);

  // Valider le token une fois qu'on l'a (depuis le routeur ou l'URL)
  useEffect(() => {
    if (!urlChecked) return;
    const currentToken = token ?? getTokenFromUrl();
    if (!currentToken) {
      setError("Lien d'invitation invalide. Aucun token fourni.");
      setValidating(false);
      return;
    }

    let cancelled = false;
    async function validateInvite() {
      try {
        const response = await fetch(`/api/invites/validate?token=${encodeURIComponent(currentToken ?? "")}`);
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok || data.error) {
          setError(data.error || "Lien d'invitation invalide ou expiré.");
          setValidating(false);
          return;
        }

        setInviteData({
          email: data.email ?? "",
          garage_id: data.garage_id ?? null,
        });
        setEmail(data.email ?? "");
        if (token !== currentToken) setToken(currentToken);
      } catch {
        if (!cancelled) setError("Erreur lors de la validation de l'invitation.");
      }
      if (!cancelled) setValidating(false);
    }

    validateInvite();
    return () => { cancelled = true; };
  }, [urlChecked, token]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (!token) {
      setError("Token d'invitation manquant.");
      return;
    }

    setLoading(true);

    try {
      // 1. Créer l'utilisateur Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: inviteData!.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Erreur lors de la création du compte.");
        setLoading(false);
        return;
      }

      // 2. Marquer l'invitation comme utilisée et lier au garage
      const useResponse = await fetch("/api/invites/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          user_id: authData.user.id,
          garage_id: inviteData!.garage_id,
        }),
      });

      const useData = await useResponse.json();

      if (!useResponse.ok || useData.error) {
        // L'utilisateur est créé mais l'invitation n'a pas été marquée
        // On continue quand même, l'admin pourra corriger
        console.error("Erreur lors de l'utilisation de l'invitation:", useData.error);
      }

      setLoading(false);

      // 3. Si la session est disponible, connecter directement
      if (authData.session) {
        await new Promise(resolve => setTimeout(resolve, 100));
        router.push("/dashboard");
        router.refresh();
      } else {
        // Sinon, afficher un message de confirmation
        setError(null);
        alert("Compte créé avec succès ! Vérifie ton email pour confirmer, puis reconnecte-toi.");
        router.push("/login");
      }
    } catch (err) {
      setError("Erreur lors de la création du compte.");
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="w-full max-w-[420px] border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Validation de l'invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="w-full max-w-[420px] border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Invitation invalide
            </CardTitle>
            <CardDescription>
              Ce lien d&apos;invitation est invalide ou a expiré.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 p-3 rounded-input bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-4">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Retour à la connexion
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-[420px] border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
        <CardHeader className="space-y-3">
          <CardTitle className="text-2xl font-semibold text-foreground">
            Créer mon compte
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground leading-relaxed">
            Tu as été invité à rejoindre GarageOS. Complète ton inscription ci-dessous.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  readOnly
                  className="pl-10 bg-muted/50 cursor-not-allowed"
                />
                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-success" />
              </div>
              <p className="text-xs text-muted-foreground">
                Cet email est défini par ton invitation.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirmer le mot de passe
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-input bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création du compte...
                </>
              ) : (
                "Créer mon compte"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Déjà un compte ? Se connecter
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/20">
        <Card className="w-full max-w-[420px] border-border/50 shadow-xl backdrop-blur-sm bg-card/95">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Chargement...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  );
}
