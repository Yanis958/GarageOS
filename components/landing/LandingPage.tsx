"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardPreviewMock } from "./DashboardPreviewMock";
import {
  FileText,
  Receipt,
  Users,
  Bell,
  Building2,
  Lock,
  Mail,
  UserPlus,
  LayoutDashboard,
} from "lucide-react";

const BADGES = [
  { label: "Devis" },
  { label: "Factures" },
  { label: "Clients" },
  { label: "Véhicules" },
  { label: "Copilote IA" },
];

const AVANTAGES = [
  {
    title: "Générez vos devis en 30 secondes",
    description: "L’IA propose lignes et montants. Vous validez, le client reçoit.",
    icon: FileText,
  },
  {
    title: "Devis → facture en un clic",
    description: "Devis accepté ? Passez en facture sans ressaisir.",
    icon: Receipt,
  },
  {
    title: "Clients & véhicules centralisés",
    description: "Un historique clair par client et par véhicule.",
    icon: Users,
  },
  {
    title: "Relances automatiques",
    description: "Suivez les devis en attente et rappelez au bon moment.",
    icon: Bell,
  },
  {
    title: "Données 100 % séparées par garage",
    description: "Chaque garage ne voit que ses propres données.",
    icon: Building2,
  },
  {
    title: "Accès sur invitation uniquement",
    description: "Vos données restent entre vous et vos équipes.",
    icon: Lock,
  },
];

const ETAPES = [
  { step: 1, text: "Vous recevez une invitation", icon: Mail },
  { step: 2, text: "Vous créez votre compte", icon: UserPlus },
  { step: 3, text: "Vous gérez devis, factures et IA", icon: LayoutDashboard },
];

const FAQ = [
  {
    q: "Puis-je créer un compte sans invitation ?",
    a: "Non. L’accès se fait uniquement sur invitation. Demandez un lien à l’administrateur de votre garage.",
  },
  {
    q: "Mes données sont-elles séparées des autres garages ?",
    a: "Oui. Chaque garage dispose de ses propres données (clients, véhicules, devis, factures).",
  },
  {
    q: "Je dois intégrer un paiement dans l’app ?",
    a: "Non. GARAGE OS ne gère pas les encaissements. Le garage encaisse comme d’habitude (CB, chèque, etc.).",
  },
];

/** Hero : titre impactant, glow, CTA "Accéder à mon espace" ou slot enfants (formulaire login) */
export function LandingHero({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden px-4 py-20 sm:py-24 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-14">
          <div className="flex flex-1 flex-col items-center text-center lg:items-center lg:text-center">
            <div className="relative inline-block">
              <span className="absolute -inset-4 rounded-full bg-primary/20 blur-2xl" aria-hidden />
              <h1 className="relative text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-6xl">
                GARAGE OS
              </h1>
            </div>
            <p className="relative mt-6 max-w-xl text-xl font-medium text-foreground sm:text-2xl">
              La gestion de votre garage, simplifiée.
            </p>
            <p className="relative mt-2 max-w-lg text-base text-muted-foreground">
              Devis, factures et suivi clients. Sans la paperasse.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              {BADGES.map((b) => (
                <Badge
                  key={b.label}
                  variant="secondary"
                  className="rounded-button border border-primary/30 bg-primary/15 text-foreground transition-colors hover:border-primary/50 hover:bg-primary/25"
                >
                  {b.label}
                </Badge>
              ))}
            </div>
            <p className="relative mt-4 text-sm text-foreground/80">
              Multi-garages · Données séparées · Devis & factures rapides
            </p>
            <div className="relative mt-10 w-full max-w-md flex flex-col items-center gap-4">
              {children}
            </div>
          </div>
          <div className="w-full max-w-md flex-shrink-0 lg:max-w-sm">
            <DashboardPreviewMock />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Sections : Avantages, Comment ça marche, FAQ, Footer */
export function LandingSections() {
  return (
    <>
      {/* Features — bénéfices business, hover premium */}
      <section className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Pourquoi GARAGE OS
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            CRM garage pensé pour le résultat : moins de temps en admin, plus pour vos clients.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {AVANTAGES.map((item) => {
              const Icon = item.icon;
              return (
                <Card
                  key={item.title}
                  className="border-border bg-card/50 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <CardHeader>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
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

      {/* Comment ça marche — ligne horizontale, étapes claires */}
      <section className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Comment ça marche
          </h2>
          <div className="relative mt-14 flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            {ETAPES.map((e) => {
              const Icon = e.icon;
              return (
                <div key={e.step} className="relative flex flex-1 flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/40 bg-primary/10 text-primary shadow-lg shadow-primary/10">
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="mt-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {e.step}
                  </span>
                  <p className="mt-3 text-sm font-medium text-foreground">{e.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ — contraste, séparateurs */}
      <section className="border-t border-border px-4 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Questions fréquentes
          </h2>
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

      {/* Footer — minimal, pro */}
      <footer className="border-t border-border px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row flex-wrap">
          <span className="text-sm text-muted-foreground">
            © GARAGE OS – SaaS privé pour garages
          </span>
          <div className="flex items-center gap-6">
            <a
              href="mailto:support@garageos.com"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Support
            </a>
            <Link
              href="/login"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Accès sur invitation
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}

export function LandingPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <LandingHero>
        <Button asChild size="lg" className="rounded-button px-8 text-base font-semibold">
          <Link href="/login">Accéder à mon espace</Link>
        </Button>
        <p className="text-xs text-muted-foreground">Accès uniquement sur invitation</p>
      </LandingHero>
      <LandingSections />
    </div>
  );
}
