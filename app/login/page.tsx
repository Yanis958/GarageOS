"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Loader2, Mail, Lock, FileText, Receipt, Users, Bell, Building2, UserPlus, LayoutDashboard, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { DashboardPreviewMock } from "@/components/landing/DashboardPreviewMock";

const ALLOW_PUBLIC_SIGNUP = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";

const BADGES = [
  { label: "Devis" },
  { label: "Factures" },
  { label: "Clients" },
  { label: "Véhicules" },
  { label: "Copilote IA" },
];

const AVANTAGES = [
  { title: "Générez vos devis en 30 secondes", description: "L'IA propose lignes et montants. Vous validez, le client reçoit.", icon: FileText },
  { title: "Devis → facture en un clic", description: "Devis accepté ? Passez en facture sans ressaisir.", icon: Receipt },
  { title: "Clients & véhicules centralisés", description: "Un historique clair par client et par véhicule.", icon: Users },
  { title: "Relances automatiques", description: "Suivez les devis en attente et rappelez au bon moment.", icon: Bell },
  { title: "Données 100 % séparées par garage", description: "Chaque garage ne voit que ses propres données.", icon: Building2 },
  { title: "Accès sur invitation uniquement", description: "Vos données restent entre vous et vos équipes.", icon: Lock },
];

const ETAPES = [
  { step: 1, text: "Vous recevez une invitation", icon: Mail },
  { step: 2, text: "Vous créez votre compte", icon: UserPlus },
  { step: 3, text: "Vous gérez devis, factures et IA", icon: LayoutDashboard },
];

const FAQ = [
  { q: "Puis-je créer un compte sans invitation ?", a: "Non. L'accès se fait uniquement sur invitation. Demandez un lien à l'administrateur de votre garage." },
  { q: "Mes données sont-elles séparées des autres garages ?", a: "Oui. Chaque garage dispose de ses propres données (clients, véhicules, devis, factures)." },
  { q: "Je dois intégrer un paiement dans l'app ?", a: "Non. GARAGE OS ne gère pas les encaissements. Le garage encaisse comme d'habitude (CB, chèque, etc.)." },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  function extractTokenFromInviteInput(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      if (trimmed.includes("token=")) {
        const href = trimmed.startsWith("http") ? trimmed : `https://dummy.com${trimmed.startsWith("?") ? trimmed : `?${trimmed}`}`;
        const url = new URL(href);
        const t = url.searchParams.get("token");
        return t || null;
      }
      if (trimmed.length >= 16 && /^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
      if (trimmed.startsWith("http")) {
        const url = new URL(trimmed);
        return url.searchParams.get("token");
      }
    } catch {
      return null;
    }
    return null;
  }

  function handleActivateInvite() {
    setInviteError(null);
    const token = extractTokenFromInviteInput(inviteInput);
    if (token) {
      setInviteModalOpen(false);
      setInviteInput("");
      router.push(`/invite?token=${encodeURIComponent(token)}`);
    } else {
      setInviteError("Lien ou token invalide. Collez le lien reçu par email.");
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResetSuccess(false);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      if (signInError.message.includes("Invalid login credentials")) setError("Email ou mot de passe incorrect.");
      else if (signInError.message.includes("Email not confirmed")) setError("Vérifie ton email pour confirmer ton compte.");
      else setError(signInError.message);
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
    router.push("/dashboard");
    router.refresh();
  }

  async function handleResetPassword(e: React.MouseEvent) {
    e.preventDefault();
    if (!email) {
      setError("Saisis ton email pour réinitialiser ton mot de passe.");
      return;
    }
    setLoading(true);
    setError(null);
    setResetSuccess(false);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);
    if (resetError) setError(resetError.message);
    else {
      setError(null);
      setResetSuccess(true);
    }
  }

  return (
    <div className="dark min-h-screen w-full bg-background text-foreground">
      <section className="relative overflow-hidden px-4 py-20 sm:py-24 md:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-14">
            <div className="flex flex-1 flex-col items-center text-center lg:items-center lg:text-center">
              <div className="relative inline-block">
                <span className="absolute -inset-4 rounded-full bg-primary/20 blur-2xl" aria-hidden />
                <h1 className="relative text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">GARAGE OS</h1>
              </div>
              <p className="relative mt-6 max-w-xl text-xl font-medium text-foreground sm:text-2xl">
                La gestion de votre garage, simplifiée.
              </p>
              <p className="relative mt-2 max-w-lg text-base text-muted-foreground">
                Devis, factures et suivi clients. Sans la paperasse.
              </p>
              <div className="relative mt-8 flex flex-wrap justify-center gap-3">
                {BADGES.map((b) => (
                  <Badge key={b.label} variant="secondary" className="rounded-button border border-primary/30 bg-primary/15 text-foreground transition-colors hover:border-primary/50 hover:bg-primary/25">{b.label}</Badge>
                ))}
              </div>
              <p className="relative mt-4 text-sm text-foreground/80">
                Multi-garages · Données séparées · Devis & factures rapides
              </p>
              <div className="relative mt-10 w-full max-w-md">
                <Card className="w-full border-border text-left">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-xl font-semibold">Connexion</CardTitle>
                    <CardDescription className="text-sm text-muted-foreground">
                      Accès client — connecte-toi pour accéder au tableau de bord.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input id="email" type="email" placeholder="ton@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-input border-border bg-background pl-10 focus-visible:ring-primary" required disabled={loading} autoComplete="email" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium">Mot de passe</Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-input border-border bg-background pl-10 pr-10 focus-visible:ring-primary" required disabled={loading} autoComplete="current-password" />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-border bg-background text-primary focus-visible:ring-primary" />
                        <span className="text-sm text-muted-foreground">Se souvenir de moi</span>
                      </label>
                      {error && (
                        <div className="flex items-start gap-2 rounded-input border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}
                      {resetSuccess && (
                        <div className="rounded-input border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                          Email de réinitialisation envoyé. Vérifie ta boîte mail.
                        </div>
                      )}
                      <Button type="submit" className="w-full rounded-button" disabled={loading}>
                        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Connexion...</> : "Se connecter"}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Accès uniquement sur invitation. Utilisez le lien reçu de l&apos;administrateur.
                      </p>
                    </form>
                    <div className="mt-6 space-y-3 text-center">
                      <button type="button" onClick={handleResetPassword} disabled={loading} className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">Mot de passe oublié ?</button>
                      <div className="border-t border-border pt-3">
                        {ALLOW_PUBLIC_SIGNUP ? (
                          <Link href="/signup" className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline">Créer un compte</Link>
                        ) : (
                          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                            <button type="button" onClick={() => { setInviteModalOpen(true); setInviteError(null); setInviteInput(""); }} className="text-sm font-medium text-primary underline-offset-4 hover:underline">Activer mon invitation</button>
                            <a href="mailto:support@garageos.com?subject=Demande d'invitation" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Demander une invitation</a>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            <div className="w-full max-w-md flex-shrink-0 lg:max-w-sm">
              <DashboardPreviewMock />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Pourquoi GARAGE OS</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">CRM garage pensé pour le résultat : moins de temps en admin, plus pour vos clients.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {AVANTAGES.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="border-border bg-card/50 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                  <CardHeader>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary"><Icon className="h-6 w-6" /></div>
                    <CardTitle className="text-lg font-semibold">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Comment ça marche</h2>
          <div className="relative mt-14 flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            {ETAPES.map((e) => {
              const Icon = e.icon;
              return (
                <div key={e.step} className="relative flex flex-1 flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 text-primary shadow-lg shadow-primary/10">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="mt-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{e.step}</span>
                  <p className="mt-3 text-sm font-medium text-foreground">{e.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Questions fréquentes</h2>
          <ul className="mt-12 divide-y divide-border">
            {FAQ.map((item) => (
              <li key={item.q} className="py-6 first:pt-0">
                <h3 className="font-semibold text-foreground">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row flex-wrap">
          <span className="text-sm text-muted-foreground">© GARAGE OS – SaaS privé pour garages</span>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            <a href="mailto:support@garageos.com" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Support</a>
            <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Accès sur invitation</Link>
            <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Retour à l&apos;accueil</Link>
          </div>
        </div>
      </footer>

      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activer mon invitation</DialogTitle>
            <DialogDescription>Collez le lien d&apos;invitation reçu par email ou le token.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invite-link">Lien d&apos;invitation</Label>
            <Input
              id="invite-link"
              placeholder="https://.../invite?token=... ou coller le token"
              value={inviteInput}
              onChange={(e) => { setInviteInput(e.target.value); setInviteError(null); }}
              className="rounded-input border-border bg-background focus-visible:ring-primary"
            />
            {inviteError && (
              <p className="text-sm text-destructive">{inviteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setInviteModalOpen(false)} className="rounded-button">Annuler</Button>
            <Button type="button" onClick={handleActivateInvite} className="rounded-button">Activer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
