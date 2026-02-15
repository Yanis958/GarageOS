# Plan : Nouvelle DA Premium GarageOS - Style Notion/Linear/Stripe

## Objectif
Transformer complètement l'interface GarageOS avec une nouvelle direction artistique premium inspirée des meilleurs SaaS B2B (Notion, Linear, Stripe Dashboard), en conservant strictement la police d'écriture existante.

## Nouvelle Direction Artistique

### Palette de couleurs (NOUVELLE DA)

**Couleurs principales :**
- **Indigo profond** : `#1E1B4B` (HSL: 251 60% 20%) - Couleur principale, actions importantes
- **Violet doux** : `#A78BFA` (HSL: 258 90% 76%) - Couleur secondaire, IA, accents
- **Vert doux premium** : `#10B981` (HSL: 160 84% 39%) - Succès, inclus, accepté
- **Orange ambré** : `#F59E0B` (HSL: 38 92% 50%) - Option, attention, info
- **Rouge sobre** : `#EF4444` (HSL: 0 84% 60%) - Destructif, refusé

**Fonds et surfaces :**
- Fond principal : `#FAFAFA` (gris très clair / blanc cassé)
- Cartes : `#FFFFFF` (blanc pur)
- Bordures : `#E5E7EB` (gris très clair)
- Texte principal : `#111827` (gris très foncé)
- Texte secondaire : `#6B7280` (gris moyen)

**Contrastes WCAG AA :**
- Tous les contrastes vérifiés pour accessibilité minimale AA

### Typographie
⚠️ **NE JAMAIS CHANGER LA POLICE EXISTANTE**
- Titres : semi-bold (font-semibold)
- Sous-titres : medium (font-medium)
- Texte : regular (font-normal)
- Chiffres/montants : semi-bold (font-semibold), très lisibles

### Coins et ombres
- Coins arrondis : 10px (rounded-lg)
- Ombres très légères : `shadow-sm` (presque imperceptibles)
- Pas de glassmorphism excessif

## Architecture de transformation

### Phase 1 : Système de design (Foundation)

#### 1.1 Mise à jour des variables CSS (`app/globals.css`)

**Nouvelles variables de couleurs :**
```css
:root {
  /* Nouvelle palette principale */
  --primary: 251 60% 20%;        /* Indigo profond #1E1B4B */
  --primary-foreground: 0 0% 100%;
  
  /* Nouvelle palette secondaire */
  --secondary: 258 90% 76%;      /* Violet doux #A78BFA */
  --secondary-foreground: 251 60% 20%;
  
  /* Accents */
  --success: 160 84% 39%;        /* Vert doux #10B981 */
  --success-foreground: 0 0% 100%;
  
  --warning: 38 92% 50%;         /* Orange ambré #F59E0B */
  --warning-foreground: 0 0% 100%;
  
  --destructive: 0 84% 60%;       /* Rouge sobre #EF4444 */
  --destructive-foreground: 0 0% 100%;
  
  /* Surfaces */
  --background: 0 0% 98%;         /* #FAFAFA */
  --foreground: 220 13% 18%;      /* #111827 */
  --card: 0 0% 100%;              /* #FFFFFF */
  --card-foreground: 220 13% 18%;
  --border: 220 13% 91%;          /* #E5E7EB */
  --muted: 220 13% 96%;
  --muted-foreground: 220 9% 46%; /* #6B7280 */
  
  /* Radius */
  --radius: 0.625rem;            /* 10px */
}
```

#### 1.2 Mise à jour Tailwind config (`tailwind.config.ts`)

Ajouter les nouvelles couleurs dans l'extension theme :
- `indigo` (primary)
- `violet` (secondary)
- `emerald` (success)
- `amber` (warning)
- `red` (destructive)

### Phase 2 : Sidebar premium

#### 2.1 Refonte sidebar (`app/dashboard/layout.tsx`)

**Style Notion/Linear :**
- Fond : blanc pur avec bordure droite subtile
- Logo : Indigo profond avec icône moderne
- Navigation : 
  - État actif : fond indigo très léger + texte indigo + bordure gauche indigo
  - Hover : fond gris très léger
  - Transitions douces (150ms)
- Espacement généreux (padding 24px)

### Phase 3 : Page Devis - Cœur de l'application

#### 3.1 Header de page (`app/dashboard/devis/[id]/page.tsx`)

**Style premium :**
- Titre : `text-3xl font-semibold` en indigo profond
- Sous-titre : `text-sm text-muted-foreground`
- Actions contextuelles alignées à droite
- Espacement vertical généreux

#### 3.2 Bloc "Génération IA" (`app/dashboard/devis/[id]/DevisEditForm.tsx`)

**Carte mise en avant :**
- Fond : blanc pur avec bordure subtile
- Ombre : `shadow-sm`
- Padding : `p-6`
- Champ textarea :
  - Bordure : `border-border`
  - Focus : ring indigo
  - Placeholder : texte gris clair
- Bouton principal :
  - Fond : violet doux (`bg-secondary`)
  - Texte : indigo profond
  - Icône ✨ Sparkles
  - Hover : violet plus foncé
  - Shadow : `shadow-sm hover:shadow-md`
- États loading :
  - Spinner violet
  - Texte "Analyse de l'intervention..."
- États erreur :
  - Message clair en rouge sobre

#### 3.3 Tableau "Lignes d'intervention" (`components/dashboard/DevisLineEditor.tsx`)

**Table avancée premium :**

**En-têtes :**
- Fond : gris très léger (`bg-muted/50`)
- Texte : `text-xs font-semibold uppercase tracking-wide text-muted-foreground`
- Padding : `px-4 py-3`
- Bordure inférieure : `border-b border-border`

**Lignes :**
- Fond : blanc pur
- Hover : `hover:bg-indigo/5` (très subtil)
- Padding : `px-4 py-3`
- Transitions : `transition-colors duration-150`
- Séparateurs : `border-b border-border/50`

**Colonnes :**

1. **Type (avec icône)** :
   - Icônes Lucide : Wrench (pièce), Clock (main-d'œuvre), Package (forfait)
   - Taille : `h-4 w-4`
   - Couleur : `text-muted-foreground`
   - Select : style minimaliste

2. **Description** :
   - Input sans bordure visible
   - Focus : ring indigo
   - Placeholder : gris clair

3. **Qté / Heures** :
   - Affichage intelligent :
     - Pour main-d'œuvre : heures + minutes (ex: "1h30")
     - Pour pièces : nombre entier
   - Input : style minimaliste
   - Texte secondaire : `text-xs text-muted-foreground`

4. **Prix unitaire HT** :
   - Input : style minimaliste
   - Alignement : droite
   - Format : nombre avec 2 décimales

5. **Total HT** :
   - Typographie : `font-semibold tabular-nums`
   - Alignement : droite
   - Couleur : indigo profond

6. **Actions** :
   - Boutons icônes : style ghost
   - Hover : fond gris léger
   - Couleur destructive pour supprimer

**Badges :**

1. **Badge IA** (violet doux) :
   - Fond : `bg-violet-100` (clair)
   - Texte : `text-violet-700`
   - Bordure : `border border-violet-200`
   - Icône : Sparkles
   - Tooltip : "Suggestion générée automatiquement. Modifiable par le garage."

2. **Badge Inclus** (vert doux) :
   - Fond : `bg-emerald-50`
   - Texte : `text-emerald-700`
   - Bordure : `border border-emerald-200`
   - Tooltip : "Inclus dans l'intervention, non facturé."

3. **Badge Option** (orange ambré) :
   - Fond : `bg-amber-50`
   - Texte : `text-amber-700`
   - Bordure : `border border-amber-200`
   - Tooltip : "Recommandé mais non obligatoire."

**Groupes visuels :**
- Séparateurs subtils entre groupes (pièces / main-d'œuvre / forfaits)
- Titres de groupe discrets (optionnel) : `text-xs font-semibold uppercase text-muted-foreground`

#### 3.4 Bloc Totaux (`app/dashboard/devis/[id]/DevisEditForm.tsx`)

**Carte premium en bas :**
- Fond : blanc pur
- Bordure : subtile
- Ombre : `shadow-sm`
- Padding : `p-8`
- Alignement : droite

**Hiérarchie visuelle :**
```
Total HT         125,00 €
TVA (20%)         25,00 €
─────────────────────────
TOTAL TTC        150,00 €  (très visible, text-3xl font-bold)
```

**Styles :**
- Total HT : `text-base text-muted-foreground`
- TVA : `text-base text-muted-foreground`
- Séparateur : `border-t border-border`
- TOTAL TTC : `text-3xl font-bold text-indigo-900` (indigo très foncé)
- Texte secondaire : `text-xs text-muted-foreground mt-2` - "Devis clair, sans frais cachés"

#### 3.5 Actions latérales sticky (`app/dashboard/devis/[id]/DevisEditForm.tsx`)

**Barre d'actions à droite :**
- Position : sticky en haut à droite
- Fond : blanc pur avec ombre légère
- Padding : `p-4`
- Border-radius : `rounded-lg`
- Bordure : subtile

**Boutons :**

1. **Enregistrer** (principal) :
   - Fond : indigo profond (`bg-indigo-900`)
   - Texte : blanc
   - Hover : indigo plus foncé
   - Shadow : `shadow-sm hover:shadow-md`

2. **Envoyer au client** (secondaire) :
   - Fond : violet doux (`bg-violet-400`)
   - Texte : indigo profond
   - Hover : violet plus foncé

3. **Télécharger PDF** (outline) :
   - Bordure : indigo
   - Texte : indigo
   - Hover : fond indigo très léger

4. **Dupliquer** (outline) :
   - Style similaire à PDF

5. **Marquer accepté** (succès) :
   - Fond : vert doux (`bg-emerald-500`)
   - Texte : blanc
   - Icône : CheckCircle

6. **Marquer refusé** (destructif) :
   - Fond : rouge sobre (`bg-red-500`)
   - Texte : blanc
   - Icône : XCircle

7. **Supprimer** (destructif) :
   - Style outline rouge
   - Confirmation modale obligatoire

**Espacement :**
- Gap entre boutons : `gap-2`
- Boutons principaux : `w-full`
- Boutons secondaires : `w-full` ou `flex-1`

### Phase 4 : Composants UI généraux

#### 4.1 Cards (`components/ui/card.tsx`)

**Style premium :**
- Fond : blanc pur
- Bordure : `border-border/50`
- Ombre : `shadow-sm`
- Border-radius : `rounded-lg` (10px)
- Padding : `p-6`

#### 4.2 Buttons (`components/ui/button.tsx`)

**Variants premium :**
- Primary : indigo profond
- Secondary : violet doux
- Success : vert doux
- Warning : orange ambré
- Destructive : rouge sobre
- Outline : bordure + texte, hover fond léger
- Ghost : transparent, hover fond très léger

**Transitions :**
- Tous les boutons : `transition-all duration-150`
- Hover : légère élévation (`hover:shadow-md`)

#### 4.3 Inputs (`components/ui/input.tsx`)

**Style minimaliste premium :**
- Bordure : `border-border`
- Focus : ring indigo (`focus-visible:ring-indigo-500`)
- Border-radius : `rounded-lg`
- Padding : `px-4 py-2`

#### 4.4 Badges (`components/dashboard/StatusBadge.tsx`)

**Style premium :**
- Bordures visibles
- Fonds très légers
- Typographie : `font-semibold`
- Padding : `px-3 py-1`
- Border-radius : `rounded-md`

**Couleurs par statut :**
- Brouillon : gris
- Envoyé : orange ambré
- Accepté : vert doux
- Refusé : rouge sobre
- Expiré : orange ambré

### Phase 5 : Dashboard home

#### 5.1 KPI Cards (`components/dashboard/DashboardCard.tsx`)

**Style premium :**
- Fond : blanc pur
- Bordure gauche : 4px colorée selon type
- Ombre : `shadow-sm`
- Hover : `hover:shadow-md hover:-translate-y-0.5`
- Padding : `p-6`
- Icônes : avec fond coloré très léger

#### 5.2 Tableaux (`app/dashboard/page.tsx`)

**Style premium :**
- En-têtes : fond gris très léger, texte uppercase
- Lignes : hover subtil
- Badges : style premium
- Espacement généreux

### Phase 6 : Micro-interactions

#### 6.1 Transitions globales
- Durée standard : `duration-150` (150ms)
- Durée hover : `duration-200` (200ms)
- Easing : `ease-in-out`

#### 6.2 Effets hover
- Boutons : élévation légère (`hover:shadow-md`)
- Cartes : élévation + translation (`hover:-translate-y-0.5`)
- Liens : changement de couleur avec transition
- Tableaux : fond très léger au hover

#### 6.3 États loading
- Spinners : couleur indigo ou violet
- Skeleton loaders : style minimaliste
- Désactivation visuelle pendant chargement

## Fichiers à modifier

### Fichiers de design system
1. **`app/globals.css`**
   - Remplacer complètement les variables CSS avec nouvelle palette
   - Ajouter commentaires pour chaque couleur

2. **`tailwind.config.ts`**
   - Ajouter nouvelles couleurs dans theme.extend.colors
   - Mettre à jour borderRadius si nécessaire

### Fichiers layout
3. **`app/dashboard/layout.tsx`**
   - Refonte sidebar avec nouveau style
   - Nouveaux styles de navigation

### Fichiers page devis
4. **`app/dashboard/devis/[id]/page.tsx`**
   - Améliorer header de page

5. **`app/dashboard/devis/[id]/DevisEditForm.tsx`**
   - Refonte bloc génération IA
   - Refonte bloc totaux
   - Refonte actions latérales sticky
   - Améliorer espacements et hiérarchie

### Composants
6. **`components/dashboard/DevisLineEditor.tsx`**
   - Refonte complète du tableau
   - Nouveaux styles de badges
   - Améliorer groupes visuels
   - Ajouter tooltips

7. **`components/dashboard/StatusBadge.tsx`**
   - Nouveaux styles avec nouvelle palette

8. **`components/dashboard/DashboardCard.tsx`**
   - Nouveaux styles KPI cards

9. **`components/ui/card.tsx`**
   - Améliorer styles de base

10. **`components/ui/button.tsx`**
    - Ajouter nouveaux variants avec nouvelle palette

11. **`components/ui/input.tsx`**
    - Améliorer styles minimalistes

### Fichiers dashboard
12. **`app/dashboard/page.tsx`**
    - Améliorer tableaux avec nouveau style

## Ordre d'implémentation recommandé

1. **Foundation** (Phase 1)
   - Mettre à jour `globals.css` avec nouvelle palette
   - Mettre à jour `tailwind.config.ts`
   - Vérifier que tout compile

2. **Composants de base** (Phase 4)
   - Mettre à jour Card, Button, Input
   - Mettre à jour StatusBadge

3. **Sidebar** (Phase 2)
   - Refonte complète sidebar

4. **Page Devis - Bloc IA** (Phase 3.2)
   - Refonte bloc génération IA

5. **Page Devis - Tableau** (Phase 3.3)
   - Refonte complète tableau lignes

6. **Page Devis - Totaux** (Phase 3.4)
   - Refonte bloc totaux

7. **Page Devis - Actions** (Phase 3.5)
   - Refonte actions latérales sticky

8. **Dashboard home** (Phase 5)
   - Améliorer KPI cards et tableaux

9. **Micro-interactions** (Phase 6)
   - Ajouter transitions et effets hover partout

10. **Polish final**
    - Vérifier cohérence visuelle
    - Ajuster espacements
    - Tester responsive

## Points d'attention

### Règles absolues
- **NE JAMAIS CHANGER LA POLICE D'ÉCRITURE** : Conserver strictement la police existante
- **Respecter l'existant** : Ne pas casser la logique métier
- **Design sobre** : Pas de glassmorphism excessif, pas d'effets flashy

### Accessibilité
- Tous les contrastes WCAG AA minimum
- Focus visible sur tous les éléments interactifs
- Labels clairs pour tous les champs

### Performance
- Transitions CSS uniquement (pas de JavaScript lourd)
- Pas d'animations excessives
- Optimiser les ombres et effets

### Responsive
- Tester sur mobile, tablette, desktop
- Sidebar collapsable sur tablette
- Tableaux scroll horizontal maîtrisé

## Résultat attendu

Une interface premium qui :
- Inspire confiance et professionnalisme (niveau Notion/Linear/Stripe)
- Fait gagner du temps au garagiste
- Rassure le client final
- Donne une image premium du garage
- Est vendable en SaaS B2B sans friction
- Respecte strictement la police existante

## Métriques de succès

- Interface visuellement au niveau des meilleurs SaaS B2B
- Nouvelle palette de couleurs cohérente partout
- Page devis ultra professionnelle et claire
- Micro-interactions fluides et agréables
- Accessibilité WCAG AA respectée
- Performance maintenue
- Responsive fonctionnel
- Police d'écriture strictement conservée
