# Plan : Améliorer la page de devis niveau SaaS premium

## Objectif
Améliorer progressivement la page de devis pour atteindre un niveau SaaS premium, ultra clair pour les garagistes ET rassurant pour les clients finaux, sans refondre complètement ni changer la police.

## Architecture

### 1. Différenciation visuelle des types de lignes

**Fichier : `components/dashboard/DevisLineEditor.tsx`** (modifier)

#### 1.1 Ajout d'icônes par type

- **Pièce** : Icône `Wrench` ou `Cog` (lucide-react) - discrète, à gauche du type
- **Main-d'œuvre** : Icône `Clock` - à gauche du type
- **Forfait** : Icône `Package` - à gauche du type

#### 1.2 Styles de fond subtils par type

- **Pièce** : Fond blanc (par défaut)
- **Main-d'œuvre** : `bg-gray-50 dark:bg-gray-900/20` sur la ligne `<tr>`
- **Forfait** : Léger encadrement ou `bg-blue-50/30 dark:bg-blue-950/20` très subtil

#### 1.3 Mise en valeur du prix horaire (main-d'œuvre)

- Afficher "60 €/h" sous la quantité pour les lignes main-d'œuvre
- Style discret mais clair (`text-xs text-muted-foreground`)

### 2. Fonction de conversion durée lisible

**Fichier : `components/dashboard/DevisLineEditor.tsx`** (nouvelle fonction)

Créer une fonction `formatDurationReadable(hours: number): string` :
- 0.5 → "30 min"
- 1 → "1 heure"
- 1.5 → "1h30"
- 2 → "2 heures"
- 2.5 → "2h30"
- etc.

Afficher sous la valeur numérique en heures, en texte gris petit (`text-xs text-muted-foreground`).

### 3. Toggle pour lignes optionnelles

**Fichier : `components/dashboard/DevisLineEditor.tsx`** (modifier)

#### 3.1 Ajout d'un état `optionalEnabled`

Pour chaque ligne optionnelle, gérer un état local `optionalEnabled: Record<string, boolean>` (défaut: toutes activées).

#### 3.2 Toggle/Checkbox dans la colonne Type

- Checkbox ou toggle Switch (shadcn/ui) à gauche du type pour les lignes optionnelles
- Si désactivé :
  - Ligne grisée (`opacity-50`)
  - `total` de la ligne = 0 dans le calcul des totaux
  - Non comptée dans les totaux HT/TTC
- Si activé :
  - Ligne normale
  - Impacte les totaux

#### 3.3 Lignes "Inclus"

- Badge "Inclus" vert (déjà présent)
- Toujours actif (pas de toggle)
- `unit_price === 0` et `isAiGenerated === true`

### 4. Badges améliorés avec tooltips

**Fichier : `components/dashboard/DevisLineEditor.tsx`** (modifier)

Utiliser le composant `Tooltip` de shadcn/ui ou améliorer les `title` HTML :

- **Badge IA** : Tooltip "Ligne proposée automatiquement par l'IA, modifiable librement"
- **Badge Option** : Tooltip "Option recommandée mais non obligatoire" + afficher `optional_reason` si présent
- **Badge Inclus** : Tooltip "Inclus dans la prestation"

### 5. Amélioration du prompt IA pour descriptions complètes

**Fichier : `app/api/ai/generate-quote-lines/route.ts`** (modifier)

Ajouter dans le prompt système :
- Générer des descriptions complètes et détaillées
- Inclure normes constructeur quand pertinent
- Quantités réalistes
- Terminologie garage standard
- Exemples concrets de bonnes descriptions

### 6. Bloc totaux amélioré

**Fichier : `app/dashboard/devis/[id]/DevisEditForm.tsx`** (modifier)

#### 6.1 Hiérarchie visuelle renforcée

- **Total TTC** : Plus grand, plus visible (text-2xl ou text-3xl)
- **TVA** : Taille moyenne, avec texte "TVA incluse" sous le TTC
- **Total HT** : Plus petit, moins visible

#### 6.2 Animation douce

Utiliser CSS transitions ou `framer-motion` pour :
- Animation `scale` légère (1.0 → 1.02) quand le total change
- Transition `fade` douce
- Durée : ~200-300ms

#### 6.3 Structure améliorée

Réorganiser le bloc pour mettre le TTC en premier et plus visible.

### 7. Micro-interactions et hover

**Fichier : `components/dashboard/DevisLineEditor.tsx`** (modifier)

#### 7.1 Hover sur les lignes

- Ajouter `hover:bg-muted/50` sur `<tr>`
- Transition douce (`transition-colors duration-150`)

#### 7.2 Boutons actions

- Boutons copier/supprimer toujours visibles mais discrets
- Hover plus visible (`hover:bg-muted`)
- Feedback visuel immédiat

## Implémentation détaillée

### Étape 1 : Différenciation visuelle

**Modifications dans `DevisLineEditor.tsx` :**

1. Importer les icônes : `Wrench`, `Clock`, `Package` de lucide-react
2. Créer une fonction `getLineTypeIcon(type: LineType)` qui retourne l'icône appropriée
3. Ajouter l'icône dans la colonne "Type" à gauche du texte
4. Ajouter des classes conditionnelles sur `<tr>` selon le type :
   ```tsx
   className={`${line.type === "labor" ? "bg-gray-50 dark:bg-gray-900/20" : ""} ${
     line.type === "forfait" ? "bg-blue-50/30 dark:bg-blue-950/20" : ""
   } hover:bg-muted/50 transition-colors duration-150`}
   ```

### Étape 2 : Conversion durée lisible

**Fichier : `components/dashboard/DevisLineEditor.tsx`**

```typescript
function formatDurationReadable(hours: number): string {
  if (hours === 0) return "";
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return wholeHours === 1 ? "1 heure" : `${wholeHours} heures`;
  }
  return `${wholeHours}h${minutes.toString().padStart(2, "0")}`;
}
```

Afficher sous la quantité pour les lignes "labor" :
```tsx
{line.type === "labor" && (
  <span className="text-xs text-muted-foreground">
    {formatDurationReadable(line.quantity)}
  </span>
)}
```

### Étape 3 : Toggle lignes optionnelles

**Fichier : `components/dashboard/DevisLineEditor.tsx`**

1. Ajouter un état local : `const [optionalEnabled, setOptionalEnabled] = useState<Record<string, boolean>>({})`
2. Initialiser : `useEffect(() => { const enabled: Record<string, boolean> = {}; lines.forEach(l => { if (l.optional) enabled[l.id] = true; }); setOptionalEnabled(enabled); }, [lines])`
3. Ajouter une colonne ou un toggle dans la colonne Type pour les lignes optionnelles
4. Modifier `updateLines` pour exclure les lignes optionnelles désactivées du calcul :
   ```typescript
   const ht = next.reduce((s, l) => {
     if (l.optional && !optionalEnabled[l.id]) return s;
     return s + l.total;
   }, 0);
   ```

### Étape 4 : Badges avec tooltips

Améliorer les `title` existants avec des messages plus clairs, ou utiliser le composant Tooltip de shadcn/ui si disponible.

### Étape 5 : Prompt IA amélioré

**Fichier : `app/api/ai/generate-quote-lines/route.ts`**

Ajouter dans le prompt :
```
DESCRIPTIONS COMPLÈTES :
- Toujours générer des descriptions complètes et détaillées
- Inclure les normes constructeur quand pertinent (ex: "norme Renault RN0700")
- Quantités réalistes et précises
- Terminologie garage standard française
- Exemples de bonnes descriptions :
  ✅ "Huile moteur 5W30 – 5L (norme constructeur Renault RN0700)"
  ✅ "Plaquettes de frein avant – Jeu complet (4 plaquettes)"
  ❌ "Huile moteur 5W30..."
```

### Étape 6 : Bloc totaux premium

**Fichier : `app/dashboard/devis/[id]/DevisEditForm.tsx`**

Modifier le bloc totaux pour mettre le TTC en premier et plus visible, avec animation douce.

## Fichiers à modifier

1. `components/dashboard/DevisLineEditor.tsx` - Différenciation visuelle, durées, toggles, badges
2. `app/dashboard/devis/[id]/DevisEditForm.tsx` - Bloc totaux amélioré
3. `app/api/ai/generate-quote-lines/route.ts` - Prompt IA amélioré pour descriptions complètes

## Points d'attention

- **Police** : Ne jamais changer la police existante
- **Progressive** : Améliorations par ajouts, pas de refonte
- **Performance** : Les animations doivent être légères
- **Accessibilité** : Les tooltips doivent être accessibles
- **Rétrocompatibilité** : Les anciens devis continuent de fonctionner
- **Logique métier** : Les lignes optionnelles désactivées ne doivent pas être sauvegardées avec `total = 0` mais exclues du calcul uniquement côté UI

## Ordre d'implémentation recommandé

1. Différenciation visuelle (icônes + fonds subtils)
2. Conversion durée lisible
3. Bloc totaux amélioré
4. Toggle lignes optionnelles
5. Badges avec tooltips améliorés
6. Prompt IA pour descriptions complètes
7. Micro-interactions et polish final
