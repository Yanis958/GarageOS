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
import { AlertCircle, Loader2, Mail, Lock, FileText, Receipt, Users, Bell, Building2, UserPlus, LayoutDashboard, Eye, EyeOff, ChevronDown } from "lucide-react";
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

const FAQ_ITEMS = [
  { q: "L'IA génère vraiment mes devis en 30 secondes ?", a: "Oui. L'IA analyse votre demande, propose automatiquement les pièces et prestations usuelles avec les tarifs. Vous validez, ajustez si besoin, et le client reçoit son devis. Fini la saisie manuelle ligne par ligne." },
  { q: "Puis-je importer mes clients et historique existants ?", a: "Absolument. Nous gérons la migration de vos données depuis votre ancien système (Excel, autre CRM, etc.). Vos clients, véhicules et historique d'interventions sont importés dès l'installation." },
  { q: "Mes données sont-elles conformes au RGPD ?", a: "Oui. Chaque garage dispose de ses propres données 100% séparées. Vos informations sont hébergées en France et conformes au RGPD. Vous gardez le contrôle total sur vos données clients." },
  { q: "Puis-je exporter mes données à tout moment ?", a: "Oui. Vous pouvez exporter l'ensemble de vos données (clients, véhicules, factures, devis) à tout moment au format Excel ou CSV. Vos données vous appartiennent." },
  { q: "Puis-je créer un compte sans invitation ?", a: "Non. L'accès se fait uniquement sur invitation. Demandez un lien à l'administrateur de votre garage qui contrôle les accès de son équipe." },
  { q: "Faut-il une formation pour utiliser l'app ?", a: "Une courte formation est incluse lors de l'installation. L'interface est intuitive et vos équipes sont autonomes dès le premier jour." },
  { q: "Que se passe-t-il si j'ai plusieurs sites ?", a: "Chaque garage a sa propre instance avec ses données séparées. Vous pouvez gérer plusieurs garages de manière indépendante." },
];

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl mb-6">Questions fréquentes</h2>
      <ul className="space-y-2">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <li key={item.q} className="rounded-lg border border-border bg-card/30 overflow-hidden transition-all duration-300">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left font-semibold text-foreground hover:bg-primary/5 transition-colors duration-200"
              >
                <span className="text-sm sm:text-base">{item.q}</span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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
                <h1 className="relative text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-5xl">
                  Le CRM qui fait gagner 2h par jour à votre garage
                </h1>
              </div>
              <p className="relative mt-6 max-w-2xl text-lg font-medium text-foreground sm:text-xl">
                Devis IA en 30 secondes • Données 100% sécurisées • Multi-garages
              </p>
              <div className="relative mt-6 flex flex-wrap justify-center gap-3">
                {BADGES.map((b) => (
                  <Badge key={b.label} variant="secondary" className="rounded-full border border-primary/30 bg-primary/15 text-foreground transition-colors hover:border-primary/50 hover:bg-primary/25">{b.label}</Badge>
                ))}
              </div>
              <div className="relative mt-10 w-full max-w-md">
                <Card className="w-full border-border bg-card/90 text-left shadow-xl">
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
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        ✓ Sans engagement • ✓ Installation en 1 jour • ✓ Support inclus
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

      <section className="border-t border-border px-4 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px] lg:gap-8 xl:gap-12">
            <div className="min-w-0 space-y-20 lg:space-y-24">
              <div>
                <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Pourquoi GARAGE OS</h2>
                <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">CRM garage pensé pour le résultat : moins de temps en admin, plus pour vos clients.</p>
                <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {AVANTAGES.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Card key={item.title} className="border-border bg-card/50 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                        <CardHeader className="space-y-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/25 text-primary">
                            <Icon className="h-7 w-7" />
                          </div>
                          <CardTitle className="text-base font-bold leading-snug">{item.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">{item.description}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div>
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

              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Ils nous font confiance</p>
                <p className="mt-2 text-lg font-semibold text-foreground">10+ garages équipés</p>
              </div>
            </div>

            <aside className="lg:sticky lg:top-8 lg:self-start space-y-8">
              <FAQAccordion />
              <div className="mt-8 w-full bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl shadow-2xl p-8 text-white">
                <div className="text-center">
                  <span className="text-4xl mb-4 block" aria-hidden>🚀</span>
                  <h3 className="text-2xl font-bold mb-3">Prêt à simplifier votre garage ?</h3>
                  <p className="text-purple-100 mb-6">
                    Demandez une démo personnalisée et découvrez comment GARAGE OS peut transformer votre quotidien.
                  </p>
                  <Button asChild className="w-full bg-white text-purple-600 font-bold px-8 py-4 rounded-xl hover:bg-purple-50 transition-all h-auto">
                    <Link href="/login">Demander une démo</Link>
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">GARAGE OS</Link>
          <div className="flex items-center gap-6">
            <a href="mailto:support@garageos.com" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Support</a>
            <Link href="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Accès sur invitation</Link>
            <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Retour à l&apos;accueil</Link>
          </div>
          <span className="text-sm text-muted-foreground">© GARAGE OS – SaaS privé pour garages</span>
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
