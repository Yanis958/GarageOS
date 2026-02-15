# GarageOS — Arborescence du projet

## Structure proposée

```
garage-os/
├── app/
│   ├── layout.tsx                 # Layout racine
│   ├── page.tsx                   # Landing /
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── app/                       # Zone protégée (dashboard + métier)
│       ├── layout.tsx             # Layout avec sidebar + auth check
│       ├── dashboard/page.tsx
│       ├── clients/
│       │   ├── page.tsx           # Liste clients
│       │   └── [id]/page.tsx      # Détail client
│       ├── vehicles/
│       │   ├── page.tsx           # Liste véhicules
│       │   └── [id]/page.tsx      # Détail véhicule
│       ├── quotes/
│       │   ├── page.tsx           # Liste devis
│       │   ├── new/page.tsx       # Nouveau devis
│       │   └── [id]/page.tsx      # Détail / édition devis
│       └── settings/page.tsx
├── components/
│   ├── ui/                        # shadcn/ui (Button, Input, Card, etc.)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── MobileNav.tsx
│   │   └── AppLayout.tsx
│   ├── clients/
│   │   ├── ClientForm.tsx
│   │   └── ClientList.tsx
│   ├── vehicles/
│   │   ├── VehicleForm.tsx
│   │   └── VehicleList.tsx
│   ├── quotes/
│   │   ├── QuoteForm.tsx
│   │   ├── QuoteLines.tsx
│   │   └── QuoteStatusBadge.tsx
│   └── dashboard/
│       └── StatsCards.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Client Supabase (browser)
│   │   ├── server.ts              # Server client + cookies
│   │   └── middleware.ts          # Auth refresh
│   ├── validations/
│   │   ├── client.ts
│   │   ├── vehicle.ts
│   │   └── quote.ts
│   ├── actions/
│   │   ├── auth.ts
│   │   ├── garage.ts
│   │   ├── clients.ts
│   │   ├── vehicles.ts
│   │   ├── quotes.ts
│   │   └── email.ts
│   └── utils.ts
├── supabase/
│   └── schema.sql                 # Schéma complet + RLS
├── public/
├── .env.local.example
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Récapitulatif des routes

| Route | Description |
|-------|-------------|
| `/` | Page d'accueil publique |
| `/auth/login` | Connexion |
| `/auth/signup` | Inscription (création garage) |
| `/app/dashboard` | Tableau de bord |
| `/app/clients` | Liste des clients |
| `/app/clients/[id]` | Fiche client |
| `/app/vehicles` | Liste des véhicules |
| `/app/vehicles/[id]` | Fiche véhicule |
| `/app/quotes` | Liste des devis |
| `/app/quotes/new` | Nouveau devis |
| `/app/quotes/[id]` | Fiche devis (voir / éditer) |
| `/app/settings` | Paramètres du garage |

## Flux multi-tenant

- À l'inscription : création d'un enregistrement `garages` + un `garage_members` avec rôle `owner`.
- Toutes les requêtes (clients, véhicules, devis) filtrent par `garage_id`.
- RLS : chaque table a une policy `garage_id IN (SELECT garage_id FROM garage_members WHERE user_id = auth.uid())`.

## Choix techniques

- **PDF** : `@react-pdf/renderer` pour un template React → PDF côté serveur (ou `pdf-lib` si préféré pour plus de contrôle).
- **Email** : pas de SMTP dans le MVP ; si pas de clé, `console.log` + toast succès.
- **Server Actions** : toutes les mutations (create, update, delete) passent par des Server Actions avec validation Zod.
