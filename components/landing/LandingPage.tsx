"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeroBeforeAfter } from "./HeroBeforeAfter";
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
  ChevronDown,
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
    description: "L'IA propose lignes et montants. Vous validez, le client reçoit.",
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

const FAQ_ITEMS = [
  {
    q: "L'IA génère vraiment mes devis en 30 secondes ?",
    a: "Oui. L'IA analyse votre demande, propose automatiquement les pièces et prestations usuelles avec les tarifs. Vous validez, ajustez si besoin, et le client reçoit son devis. Fini la saisie manuelle ligne par ligne.",
  },
  {
    q: "Puis-je importer mes clients et historique existants ?",
    a: "Absolument. Nous gérons la migration de vos données depuis votre ancien système (Excel, autre CRM, etc.). Vos clients, véhicules et historique d'interventions sont importés dès l'installation.",
  },
  {
    q: "Mes données sont-elles conformes au RGPD ?",
    a: "Oui. Chaque garage dispose de ses propres données 100% séparées. Vos informations sont hébergées en France et conformes au RGPD. Vous gardez le contrôle total sur vos données clients.",
  },
  {
    q: "Puis-je exporter mes données à tout moment ?",
    a: "Oui. Vous pouvez exporter l'ensemble de vos données (clients, véhicules, factures, devis) à tout moment au format Excel ou CSV. Vos données vous appartiennent.",
  },
  {
    q: "Puis-je créer un compte sans invitation ?",
    a: "Non. L'accès se fait uniquement sur invitation. Demandez un lien à l'administrateur de votre garage qui contrôle les accès de son équipe.",
  },
  {
    q: "Faut-il une formation pour utiliser l'app ?",
    a: "Une courte formation est incluse lors de l'installation. L'interface est intuitive et vos équipes sont autonomes dès le premier jour.",
  },
  {
    q: "Que se passe-t-il si j'ai plusieurs sites ?",
    a: "Chaque garage a sa propre instance avec ses données séparées. Vous pouvez gérer plusieurs garages de manière indépendante.",
  },
];

function FAQAccordion() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl mb-6">
        Questions fréquentes
      </h2>
      <ul className="space-y-2">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <li
              key={item.q}
              className="rounded-lg border border-border bg-card/30 overflow-hidden transition-all duration-300"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left font-semibold text-foreground hover:bg-primary/5 transition-colors duration-200"
              >
                <span className="text-sm sm:text-base">{item.q}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-primary transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid transition-all duration-300 ease-out ${
                  isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 pt-0 text-sm leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Hero : titre impactant, CTA "Demander une démo", réassurance */
export function LandingHero({ children }: { children: React.ReactNode }) {
  return (
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
                <Badge
                  key={b.label}
                  variant="secondary"
                  className="rounded-full border border-primary/30 bg-primary/15 text-foreground transition-colors hover:border-primary/50 hover:bg-primary/25"
                >
                  {b.label}
                </Badge>
              ))}
            </div>
            <div className="relative mt-10 w-full max-w-md flex flex-col items-center gap-4">
              {children}
              <p className="text-xs text-muted-foreground text-center">
                ✓ Sans engagement • ✓ Installation en 1 jour • ✓ Support inclus
              </p>
            </div>
          </div>
          <div className="w-full max-w-md flex-shrink-0 lg:max-w-sm">
            <HeroBeforeAfter />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Sections : layout 2 colonnes (contenu 60% | FAQ 40% sticky), cartes, étapes, social proof, footer */
export function LandingSections() {
  return (
    <>
      <section id="content-wrapper" className="border-t border-border px-4 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px] lg:gap-8 xl:gap-12">
            {/* Colonne gauche : Pourquoi GARAGE OS + Comment ça marche + Social proof */}
            <div id="features" className="min-w-0 space-y-20 lg:space-y-24">
              {/* Pourquoi GARAGE OS — 6 cartes, icônes grosses et colorées */}
              <div>
                <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
                  Pourquoi GARAGE OS
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
                  CRM garage pensé pour le résultat : moins de temps en admin, plus pour vos clients.
                </p>
                <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {AVANTAGES.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Card
                        key={item.title}
                        className="border-border bg-card/50 transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                      >
                        <CardHeader className="space-y-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/25 text-primary">
                            <Icon className="h-7 w-7" />
                          </div>
                          <CardTitle className="text-base font-bold leading-snug">{item.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm leading-relaxed text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Comment ça marche — 3 étapes */}
              <div>
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

              {/* Social proof — minimaliste */}
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Ils nous font confiance</p>
                <p className="mt-2 text-lg font-semibold text-foreground">10+ garages équipés</p>
              </div>
            </div>

            {/* Colonne droite : FAQ sticky accordéon */}
            <aside id="faq" className="lg:sticky lg:top-8 lg:self-start">
              <FAQAccordion />
            </aside>
          </div>
        </div>
      </section>

      {/* Footer — une ligne, logo + liens + © */}
      <footer className="border-t border-border px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            GARAGE OS
          </Link>
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
            <Link
              href="/"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
          <span className="text-sm text-muted-foreground">
            © GARAGE OS – SaaS privé pour garages
          </span>
        </div>
      </footer>
    </>
  );
}

export function LandingPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <LandingHero>
        <Button
          asChild
          size="lg"
          className="rounded-full bg-primary px-10 py-6 text-base font-semibold shadow-lg hover:bg-primary/90"
        >
          <Link href="/login">Demander une démo</Link>
        </Button>
      </LandingHero>
      <LandingSections />
    </div>
  );
}
