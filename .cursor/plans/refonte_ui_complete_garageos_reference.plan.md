# Plan : Refonte UI complète GarageOS - Style référence dashboard premium

## Objectif
Refondre complètement l'UI de GarageOS pour matcher exactement la direction artistique et la structure du dashboard de référence (cards arrondies, surfaces "soft", sidebar à gauche, topbar, widgets en grille, charts/mini-graphs, light + dark theme), en conservant strictement la police existante (Geist).

## Architecture actuelle

### Structure existante
- **Layout racine** : `app/layout.tsx` - Police Geist définie
- **Layout dashboard** : `app/dashboard/layout.tsx` - Sidebar simple sans topbar
- **Dashboard home** : `app/dashboard/page.tsx` - KPI cards et tableaux basiques
- **Pages liste** : `app/dashboard/devis/page.tsx`, `clients/page.tsx`, `vehicles/page.tsx`
- **Page devis détail** : `app/dashboard/devis/[id]/DevisEditForm.tsx`
- **Composants** : `components/dashboard/`, `components/ui/`
- **Theme** : `next-themes` installé mais non utilisé actuellement

### Palette actuelle
- Variables CSS avec indigo/violet déjà définies
- Dark mode défini dans globals.css mais non activé

## Nouvelle Direction Artistique (selon référence)

### Palette de couleurs

**Light theme :**
- Primary (accent) : `#6D5DF6` (indigo/violet) - HSL: 252 90% 68%
- Primary-2 : `#8A7CFF` (violet soft) - HSL: 252 100% 75%
- Success : `#2ECC71` (vert) - HSL: 145 63% 50%
- Warning : `#F5A623` (orange) - HSL: 38 91% 52%
- Danger : `#FF4D4F` (rouge) - HSL: 359 100% 66%
- Background : `#F4F6FB` (gris très clair) - HSL: 220 30% 96%
- Card : `#FFFFFF` (blanc pur)
- Border : `#E6EAF2` (gris très clair) - HSL: 220 20% 90%
- Text : `#0B1020` (gris très foncé) - HSL: 220 50% 8%
- Muted : `#6B7280` (gris moyen) - HSL: 220 9% 46%

**Dark theme :**
- Primary : `#6D5DF6` (même indigo/violet, plus lumineux)
- Background : `#0B1020` (noir bleuté/graphite) - HSL: 220 50% 8%
- Card : `#121A2F` (gris très foncé) - HSL: 220 40% 15%
- Border : `#24304A` (gris foncé avec transparence) - HSL: 220 35% 25%
- Text : `#E9EEFF` (blanc cassé) - HSL: 220 100% 95%
- Muted : `#A5B4FC` (lavande clair) - HSL: 252 90% 80%

### Coins et ombres
- Cards : `rounded-[18px]` à `rounded-[22px]` (18-22px)
- Inputs : `rounded-[14px]` (14px)
- Buttons : `rounded-[12px]` (12px)
- Ombres light : `shadow-sm` très subtiles
- Ombres dark : légère "glow" avec transparence, pas de shadow profonde

### Typographie
⚠️ **NE JAMAIS CHANGER LA POLICE GEIST**
- H1 : `text-[26px]` à `text-[32px]` / `font-semibold`
- H2 : `text-[18px]` à `text-[20px]` / `font-semibold`
- Label : `text-[12px]` à `text-[13px]` / `uppercase` / `tracking-wide`
- Body : `text-[14px]` à `text-[15px]` / `font-normal`
- KPI chiffres : `text-[28px]` à `text-[34px]` / `font-bold`

## Plan d'implémentation

### Phase 1 : Design System Tokens

#### 1.1 Mise à jour `app/globals.css`

**Nouvelles variables CSS pour light theme :**
```css
:root {
  /* Primary accent */
  --primary: 252 90% 68%;        /* #6D5DF6 */
  --primary-foreground: 0 0% 100%;
  --primary-2: 252 100% 75%;    /* #8A7CFF */
  
  /* Accents */
  --success: 145 63% 50%;        /* #2ECC71 */
  --success-foreground: 0 0% 100%;
  --warning: 38 91% 52%;         /* #F5A623 */
  --warning-foreground: 0 0% 100%;
  --destructive: 359 100% 66%;    /* #FF4D4F */
  --destructive-foreground: 0 0% 100%;
  
  /* Surfaces light */
  --background: 220 30% 96%;      /* #F4F6FB */
  --foreground: 220 50% 8%;      /* #0B1020 */
  --card: 0 0% 100%;              /* #FFFFFF */
  --card-foreground: 220 50% 8%;
  --border: 220 20% 90%;          /* #E6EAF2 */
  --muted: 220 15% 95%;
  --muted-foreground: 220 9% 46%;  /* #6B7280 */
  
  /* Radius */
  --radius-card: 1.25rem;         /* 20px */
  --radius-input: 0.875rem;        /* 14px */
  --radius-button: 0.75rem;       /* 12px */
}
```

**Nouvelles variables CSS pour dark theme :**
```css
.dark {
  /* Primary accent (même couleur, plus lumineux) */
  --primary: 252 90% 68%;
  --primary-foreground: 0 0% 100%;
  --primary-2: 252 100% 75%;
  
  /* Accents */
  --success: 145 63% 50%;
  --warning: 38 91% 52%;
  --destructive: 359 100% 66%;
  
  /* Surfaces dark */
  --background: 220 50% 8%;       /* #0B1020 */
  --foreground: 220 100% 95%;     /* #E9EEFF */
  --card: 220 40% 15%;            /* #121A2F */
  --card-foreground: 220 100% 95%;
  --border: 220 35% 25% / 0.5;    /* #24304A avec transparence */
  --muted: 220 35% 20%;
  --muted-foreground: 252 90% 80%; /* #A5B4FC */
}
```

#### 1.2 Mise à jour `tailwind.config.ts`

Ajouter les nouveaux radius dans theme.extend :
```typescript
borderRadius: {
  card: "var(--radius-card)",
  input: "var(--radius-input)",
  button: "var(--radius-button)",
  lg: "var(--radius-card)",
  md: "var(--radius-input)",
  sm: "var(--radius-button)",
}
```

#### 1.3 Intégration `next-themes`

**Créer `components/theme-provider.tsx` :**
```tsx
"use client";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="light" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
```

**Mettre à jour `app/layout.tsx` :**
- Envelopper children avec `<ThemeProvider>`
- Ajouter `suppressHydrationWarning` sur `<html>`

### Phase 2 : Layout Shell (Sidebar + Topbar)

#### 2.1 Composant Sidebar premium (`components/layout/Sidebar.tsx`)

**Structure :**
- Largeur : `w-[260px]` (fixe)
- Fond : `bg-card` avec bordure droite subtile
- Padding : `p-6`

**Logo/Branding :**
- Icône carrée arrondie avec gradient primary
- Texte "GarageOS" en `font-semibold`
- Nom du garage en dessous

**Navigation :**
- Items avec icônes Lucide outlined
- État actif : pill arrondi (`rounded-full`) avec `bg-primary/10` + texte `text-primary` + `font-semibold`
- Hover : `hover:bg-muted/50`
- Gap : `gap-1` entre items
- Padding items : `px-4 py-2.5`

**Footer :**
- Toggle theme (Moon/Sun icon)
- User mini-card (avatar + email)
- Border-top séparateur

#### 2.2 Composant Topbar (`components/layout/Topbar.tsx`)

**Structure :**
- Hauteur : `h-16` ou `h-20`
- Fond : `bg-card` avec bordure inférieure subtile
- Padding horizontal : `px-6`
- Sticky : `sticky top-0 z-50`
- En dark : `backdrop-blur-sm bg-card/80`

**Contenu :**
- Gauche : Greeting "Hello, [Nom] welcome back" (optionnel) ou titre de page
- Centre : Search input arrondi avec icône Search
- Droite : Bouton "Nouveau devis" (primary) + Notifications bell + User pill

**Search input :**
- Largeur : `max-w-md` ou `flex-1`
- Border-radius : `rounded-[14px]`
- Placeholder : "Rechercher un devis, client, immatriculation..."
- Icône Search à gauche

**User pill :**
- Avatar circulaire + nom + dropdown
- Hover : fond léger

#### 2.3 Mise à jour `app/dashboard/layout.tsx`

**Structure :**
```tsx
<div className="flex min-h-screen bg-background">
  <Sidebar />
  <div className="flex-1 flex flex-col">
    <Topbar />
    <main className="flex-1 p-6 lg:p-8 overflow-auto">
      {children}
    </main>
  </div>
</div>
```

**Responsive :**
- Desktop : Sidebar fixe, Topbar sticky
- Tablette : Sidebar collapsible (drawer)
- Mobile : Sidebar drawer, Topbar compact

### Phase 3 : Dashboard Home - Grille de widgets

#### 3.1 Structure grille (`app/dashboard/page.tsx`)

**Grille 12 colonnes avec gaps :**
```tsx
<div className="grid grid-cols-12 gap-5 lg:gap-6">
  {/* Row 1: KPI Cards */}
  <div className="col-span-12 lg:col-span-4">KPI 1</div>
  <div className="col-span-12 lg:col-span-4">KPI 2</div>
  <div className="col-span-12 lg:col-span-4">KPI 3</div>
  
  {/* Row 2: Charts */}
  <div className="col-span-12 lg:col-span-8">Big Chart</div>
  <div className="col-span-12 lg:col-span-4">Donut Chart</div>
  
  {/* Row 3: Lists */}
  <div className="col-span-12 lg:col-span-4">Derniers devis</div>
  <div className="col-span-12 lg:col-span-4">Top clients</div>
  <div className="col-span-12 lg:col-span-4">À traiter</div>
</div>
```

#### 3.2 KPI Cards premium (`components/dashboard/KPICard.tsx`)

**Style selon référence :**
- Card avec `rounded-[20px]`, `border border-border`, `bg-card`, `shadow-sm`
- Padding : `p-6`
- Grand chiffre : `text-[32px]` `font-bold` `text-foreground`
- Label : `text-xs` `uppercase` `tracking-wide` `text-muted-foreground`
- Delta/Trend : badge coloré (vert/rouge) avec flèche
- Mini sparkline en fond très léger (optionnel, SVG simple)

**KPI pour GarageOS :**
1. Chiffre d'affaires (mois) : valeur + delta vs mois dernier + mini graph
2. Devis ce mois : compteur + sous-texte
3. En attente : compteur + badge warning
4. Acceptés ce mois : compteur + badge success

#### 3.3 Big Chart Card (`components/dashboard/ActivityChartCard.tsx`)

**Card "Activité devis" :**
- Largeur : 8 colonnes
- Header : Titre + Dropdown pour filtres (Semaine/Mois/Année)
- Chart : Bar chart ou Line chart (utiliser recharts ou chart.js)
- Légende : Brouillon / Envoyé / Accepté / Refusé avec couleurs
- Couleurs adaptées au theme

#### 3.4 Donut Chart Card (`components/dashboard/StatusDonutCard.tsx`)

**Card "Statuts / Catégories" :**
- Largeur : 4 colonnes
- Donut chart avec segments par statut
- Légende avec pourcentages et couleurs
- Total au centre

#### 3.5 List Cards

**"Derniers devis" :**
- Liste de 6 items max
- Chaque item : Réf + Client + Montant + Badge statut
- Hover : `hover:bg-muted/50`
- Lien "Voir tout" en bas

**"À traiter" :**
- Relances, devis expirés, actions rapides
- Items avec badge warning/orange
- Boutons d'action rapides

### Phase 4 : Pages Liste (Devis/Véhicules/Clients)

#### 4.1 Structure commune

**Header de page :**
- Titre H1 : `text-[28px]` `font-semibold`
- Sous-titre optionnel
- Actions à droite : Bouton "Nouveau" (primary)

**Filtres/Search :**
- Barre de recherche arrondie
- Filtres (statut, période) en selects arrondis
- Style cohérent avec topbar

**Table premium (`components/dashboard/DataTable.tsx`) :**
- Header sticky avec fond `bg-muted/30`
- Rows avec hover `hover:bg-muted/50`
- Border-radius sur première/dernière row
- Badges statut avec nouvelles couleurs
- Actions (kebab menu) à droite
- Pagination en bas

#### 4.2 Page Devis liste (`app/dashboard/devis/page.tsx`)

**Colonnes :**
- Référence (lien)
- Client
- Statut (badge)
- Montant TTC
- Actions (kebab)

**Filtres :**
- Search (réf, client, véhicule)
- Statut dropdown
- Période dropdown
- Archived toggle

#### 4.3 Pages Véhicules et Clients

**Même structure que Devis**
**Colonnes adaptées :**
- Véhicules : Immatriculation, Marque/Modèle, Client, Actions
- Clients : Nom, Email, Téléphone, Actions

### Phase 5 : Page Devis Détail

#### 5.1 Layout deux colonnes

**Colonne gauche (flex-1) :**
- Formulaire informations (client, véhicule, validité, ref, notes)
- Bloc génération IA
- Tableau lignes d'intervention
- Bloc totaux

**Colonne droite (w-64 sticky) :**
- Barre d'actions verticale
- Boutons avec nouvelles couleurs

#### 5.2 Bloc génération IA

**Card "accent" :**
- Fond : `bg-primary/5` (très léger)
- Bordure : `border border-primary/20`
- Textarea arrondi avec focus ring primary
- Bouton avec gradient primary
- États loading/erreur améliorés

#### 5.3 Tableau lignes d'intervention

**Style premium :**
- Rows aérées avec padding généreux
- Icônes par type (Wrench, Clock, Package)
- Badges IA/Inclus/Option avec nouvelles couleurs
- Hover subtil
- Inputs sans bordure visible, focus ring primary

#### 5.4 Bloc totaux

**Card en bas :**
- Total HT et TVA en secondaire
- TOTAL TTC très visible (`text-[32px]` `font-bold` `text-primary`)
- Texte "Devis clair, sans frais cachés"
- Border-radius card

#### 5.5 Actions latérales

**Barre sticky droite :**
- Card avec bordure et ombre
- Boutons empilés avec nouvelles couleurs :
  - Enregistrer : primary
  - Envoyer : primary-2
  - PDF : outline primary
  - Dupliquer : outline primary
  - Accepté : success
  - Refusé : destructive
  - Supprimer : outline destructive

### Phase 6 : Composants UI de base

#### 6.1 Card premium (`components/ui/card.tsx`)

**Style selon référence :**
- `rounded-[20px]`
- `border border-border`
- `bg-card`
- `shadow-sm`
- Padding : `p-6`

#### 6.2 Button premium (`components/ui/button.tsx`)

**Variants :**
- Primary : `bg-primary` `text-white` `rounded-[12px]` `shadow-sm`
- Secondary : `bg-transparent` `border border-border` `rounded-[12px]`
- Destructive : `bg-destructive` `text-white` `rounded-[12px]`
- Ghost : `bg-transparent` `hover:bg-muted/50`

**Transitions :**
- `transition-all duration-150`

#### 6.3 Input premium (`components/ui/input.tsx`)

**Style :**
- `rounded-[14px]`
- `border border-border`
- `bg-background`
- Focus : `ring-2 ring-primary/40`
- Padding : `px-4 py-2.5`

#### 6.4 Badge premium (`components/dashboard/StatusBadge.tsx`)

**Style pill :**
- `rounded-full`
- `px-3 py-1`
- `text-xs` `font-semibold`
- Bordures visibles
- Fonds très légers

**Couleurs par statut :**
- Brouillon : neutral (gris)
- Envoyé : primary (indigo/violet)
- Accepté : success (vert)
- Refusé : destructive (rouge)
- Expiré : warning (orange)

### Phase 7 : Theme Toggle

#### 7.1 Composant ThemeToggle (`components/layout/ThemeToggle.tsx`)

**Bouton dans sidebar footer :**
- Icône Moon (dark) / Sun (light)
- Toggle avec `useTheme()` de next-themes
- Hover : fond léger
- Transition douce

### Phase 8 : Responsive

#### 8.1 Desktop (par défaut)
- Sidebar fixe 260px
- Topbar sticky
- Grille 12 colonnes
- Cards alignées

#### 8.2 Tablette
- Sidebar collapsible (drawer)
- Grille 6 colonnes
- Cards empilées si nécessaire

#### 8.3 Mobile
- Sidebar drawer (menu burger)
- Topbar compact
- Cards stackées
- Actions devis dans bottom sheet

## Fichiers à créer/modifier

### Nouveaux composants
1. `components/theme-provider.tsx` - Provider next-themes
2. `components/layout/Sidebar.tsx` - Sidebar premium
3. `components/layout/Topbar.tsx` - Topbar avec search
4. `components/layout/ThemeToggle.tsx` - Toggle theme
5. `components/dashboard/KPICard.tsx` - KPI card premium (refactoriser depuis DashboardCard)
6. `components/dashboard/ActivityChartCard.tsx` - Chart activité devis
7. `components/dashboard/StatusDonutCard.tsx` - Donut chart statuts
8. `components/dashboard/DataTable.tsx` - Table premium réutilisable

### Fichiers à modifier
1. `app/globals.css` - Nouveaux tokens light/dark
2. `app/layout.tsx` - Ajouter ThemeProvider
3. `tailwind.config.ts` - Nouveaux radius
4. `app/dashboard/layout.tsx` - Refonte avec Sidebar + Topbar
5. `app/dashboard/page.tsx` - Grille de widgets
6. `app/dashboard/devis/page.tsx` - Style table premium
7. `app/dashboard/clients/page.tsx` - Style table premium
8. `app/dashboard/vehicles/page.tsx` - Style table premium
9. `app/dashboard/devis/[id]/DevisEditForm.tsx` - Refonte complète
10. `components/ui/card.tsx` - Style premium
11. `components/ui/button.tsx` - Variants premium
12. `components/ui/input.tsx` - Style premium
13. `components/dashboard/StatusBadge.tsx` - Style premium
14. `components/dashboard/DevisLineEditor.tsx` - Style premium

## Ordre d'implémentation

1. **Phase 1** : Design System Tokens
   - Mettre à jour globals.css
   - Mettre à jour tailwind.config.ts
   - Créer ThemeProvider
   - Intégrer dans app/layout.tsx

2. **Phase 2** : Layout Shell
   - Créer Sidebar premium
   - Créer Topbar avec search
   - Créer ThemeToggle
   - Mettre à jour dashboard/layout.tsx

3. **Phase 3** : Dashboard Home
   - Refondre grille
   - Refondre KPI Cards
   - Créer ActivityChartCard
   - Créer StatusDonutCard
   - Refondre List Cards

4. **Phase 4** : Pages Liste
   - Créer DataTable réutilisable
   - Refondre page Devis liste
   - Refondre page Clients liste
   - Refondre page Véhicules liste

5. **Phase 5** : Page Devis Détail
   - Refondre layout deux colonnes
   - Refondre bloc IA
   - Refondre tableau lignes
   - Refondre bloc totaux
   - Refondre actions latérales

6. **Phase 6** : Composants UI
   - Refondre Card
   - Refondre Button
   - Refondre Input
   - Refondre Badge

7. **Phase 7** : Polish & Responsive
   - Tester responsive
   - Ajuster espacements
   - Vérifier contrastes
   - Tester theme toggle

## Points d'attention

### Règles absolues
- **NE JAMAIS CHANGER LA POLICE GEIST** : Conserver `geistSans` et `geistMono`
- **Respecter routes existantes** : Ne pas modifier les URLs
- **Logique métier intacte** : Ne pas toucher aux Server Actions ni à Supabase

### Accessibilité
- Contrastes WCAG AA minimum
- Focus visible sur tous les éléments
- Labels clairs

### Performance
- Transitions CSS uniquement
- Pas d'animations lourdes
- Lazy loading des charts si nécessaire

### Charts
- Utiliser `recharts` ou `chart.js` (à installer si nécessaire)
- Adapter couleurs au theme
- Mini sparklines en SVG simple

## Checklist de vérification visuelle

Après implémentation, vérifier :

1. **Design System**
   - [ ] Tokens light/dark corrects
   - [ ] Radius cohérents (20px cards, 14px inputs, 12px buttons)
   - [ ] Ombres subtiles
   - [ ] Theme toggle fonctionne

2. **Layout Shell**
   - [ ] Sidebar 260px avec logo + nav + footer
   - [ ] Topbar avec search + actions
   - [ ] Responsive (sidebar drawer mobile)

3. **Dashboard Home**
   - [ ] Grille 12 colonnes avec gaps 20-24px
   - [ ] KPI Cards avec grands chiffres + labels
   - [ ] Big Chart Card (8 col) avec activité devis
   - [ ] Donut Chart Card (4 col) avec statuts
   - [ ] List Cards alignées

4. **Pages Liste**
   - [ ] Tables avec style premium
   - [ ] Filtres/Search arrondis
   - [ ] Badges statut cohérents
   - [ ] Pagination propre

5. **Page Devis Détail**
   - [ ] Layout deux colonnes
   - [ ] Bloc IA avec style accent
   - [ ] Tableau lignes premium
   - [ ] Totaux très visibles
   - [ ] Actions latérales sticky

6. **Composants UI**
   - [ ] Cards arrondies 20px
   - [ ] Buttons arrondis 12px
   - [ ] Inputs arrondis 14px
   - [ ] Badges pill arrondis

7. **Theme**
   - [ ] Light theme cohérent
   - [ ] Dark theme cohérent
   - [ ] Transitions douces
   - [ ] Charts adaptés au theme

## Résultat attendu

Une interface premium qui :
- Match exactement le style de la référence
- Inspire confiance et professionnalisme
- Est agréable à utiliser quotidiennement
- Fait gagner du temps au garagiste
- Rassure le client final
- Respecte strictement la police Geist existante
- Fonctionne parfaitement en light et dark mode
