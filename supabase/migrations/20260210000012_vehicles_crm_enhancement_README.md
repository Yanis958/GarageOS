# Migration : Gestion Véhicules CRM (Multi-tenant)

## 📋 Résumé

Migration SQL pour vérifier et compléter le schéma de gestion des véhicules en mode CRM simple, avec isolation multi-tenant par `garage_id`.

## ✅ Ce qui a été vérifié/ajouté

### 1. Table `vehicles`
- ✅ **Vérifiée** : La table existe déjà avec les colonnes de base
- ✅ **Ajoutée** : Colonne `mileage` (kilométrage) si absente
- ✅ **Ajoutée** : Colonne `archived_by` si absente (pour soft delete)

**Colonnes finales** :
- `id` uuid PK
- `garage_id` uuid NOT NULL → `garages(id)` CASCADE
- `client_id` uuid NOT NULL → `clients(id)` CASCADE
- `registration` text NOT NULL (immatriculation, normalisée uppercase)
- `brand` text (marque)
- `model` text (modèle)
- `vin` text (numéro VIN)
- `year` int (année)
- `mileage` int (kilométrage) ← **NOUVEAU**
- `created_at` timestamptz
- `archived_at` timestamptz (soft delete)
- `archived_by` uuid → `auth.users(id)` ← **NOUVEAU**

### 2. Table `quotes`
- ✅ **Vérifié** : `vehicle_id` existe déjà (nullable, référence `vehicles(id)` ON DELETE SET NULL)
- ✅ **Index ajouté** : `idx_quotes_vehicle_id` pour performance
- ✅ **Index composite ajouté** : `idx_quotes_garage_vehicle` pour recherches rapides

### 3. Table `invoices` (factures)
- ℹ️ **Note** : Il n'y a pas de table `invoices` séparée dans ce projet
- Les factures sont des `quotes` avec `facture_number` rempli
- `vehicle_id` est déjà disponible dans `quotes`, donc pas besoin d'ajouter dans une table séparée

### 4. Contraintes qualité

#### Unicité immatriculation par garage
- ✅ **Index unique partiel** : `idx_vehicles_garage_registration_unique`
- Garantit qu'une immatriculation ne peut pas être dupliquée dans le même garage
- Normalise automatiquement en uppercase pour la comparaison
- Ignore les valeurs NULL/vides

#### Cohérence garage_id
- ✅ **Trigger** : `trigger_check_vehicle_client_garage_match`
- Garantit que `vehicles.garage_id` = `clients.garage_id` du client lié
- Empêche les incohérences multi-tenant
- **Note** : Utilise un trigger au lieu d'une contrainte CHECK car PostgreSQL n'autorise pas les sous-requêtes dans CHECK

### 5. Triggers de validation

#### Normalisation automatique de la plaque
- ✅ **Trigger** : `trigger_normalize_vehicle_registration`
- Normalise automatiquement `registration` en **UPPERCASE** et **TRIM**
- S'exécute avant INSERT et UPDATE
- Utilise la fonction `normalize_vehicle_registration()`

#### Vérification cohérence garage_id
- ✅ **Trigger** : `trigger_check_vehicle_client_garage_match`
- Vérifie que `vehicles.garage_id` correspond à `clients.garage_id`
- S'exécute avant INSERT et UPDATE (sur `garage_id` ou `client_id`)
- Utilise la fonction `check_vehicle_client_garage_match()`
- Lève une exception si les garage_id ne correspondent pas

### 6. Index de performance

**Table `vehicles`** :
- `idx_vehicles_garage_id` → Filtrage par garage
- `idx_vehicles_client_id` → Jointures avec clients
- `idx_vehicles_registration` → Recherche par immatriculation
- `idx_vehicles_archived_at` → Filtrage actifs/archivés
- `idx_vehicles_garage_client` → Recherche composite garage+client
- `idx_vehicles_garage_registration_unique` → Unicité (déjà mentionné)

**Table `quotes`** :
- `idx_quotes_vehicle_id` → Jointures avec véhicules
- `idx_quotes_garage_vehicle` → Recherche composite garage+véhicule

### 7. RLS (Row Level Security)

- ✅ **Vérifiées** : Les policies RLS existent déjà dans `20260210000001_rls_garage.sql`
- ✅ **Créées si absentes** : Policies SELECT/INSERT/UPDATE/DELETE
- Utilise la fonction `current_user_garage_ids()` pour l'isolation multi-tenant

**Policies** :
- `vehicles_garage_select` → SELECT uniquement sur les véhicules du garage de l'utilisateur
- `vehicles_garage_insert` → INSERT uniquement si garage_id autorisé
- `vehicles_garage_update` → UPDATE uniquement sur les véhicules du garage
- `vehicles_garage_delete` → DELETE uniquement sur les véhicules du garage

### 8. Fonction helper

- ✅ **Créée** : `get_client_vehicles(p_client_id uuid)`
- Retourne les véhicules actifs d'un client
- Respecte automatiquement RLS (filtre par `current_user_garage_ids()`)
- Utile pour requêtes SQL directes

## 🚀 Application de la migration

### Option 1 : Supabase SQL Editor (recommandé)

1. Ouvrir Supabase Dashboard → SQL Editor
2. Coller le contenu de `20260210000012_vehicles_crm_enhancement.sql`
3. Exécuter la migration
4. Vérifier qu'aucune erreur n'apparaît

### Option 2 : Migration automatique (si configuré)

Si vous utilisez Supabase CLI avec migrations automatiques :
```bash
supabase migration up
```

## 🔍 Vérifications post-migration

### Vérifier que la table existe
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vehicles'
ORDER BY ordinal_position;
```

### Vérifier les index
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'vehicles';
```

### Vérifier les triggers
```sql
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'vehicles';
```

### Vérifier RLS
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'vehicles';

SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'vehicles';
```

### Tester le trigger
```sql
-- Insérer un véhicule avec registration en minuscules
INSERT INTO vehicles (garage_id, client_id, registration, brand, model)
VALUES (
  'votre-garage-id',
  'votre-client-id',
  'ab-123-cd',  -- minuscules
  'Renault',
  'Clio'
);

-- Vérifier que registration est en UPPERCASE
SELECT registration FROM vehicles WHERE registration LIKE 'AB-123-CD';
-- Doit retourner 'AB-123-CD' (uppercase)
```

## 📝 Notes importantes

1. **Pas de migration destructive** : Aucune colonne supprimée, uniquement des ajouts
2. **Rétrocompatibilité** : Toutes les colonnes ajoutées sont optionnelles (sauf celles déjà NOT NULL)
3. **RLS existant** : Les policies RLS sont déjà en place, cette migration les vérifie seulement
4. **Pas de table invoices** : Les factures sont gérées via `quotes.facture_number`, donc pas besoin d'ajouter `vehicle_id` ailleurs
5. **Normalisation** : Le trigger garantit que toutes les plaques sont en uppercase, même si insérées en minuscules

## ⚠️ Points d'attention

- Le trigger `trigger_check_vehicle_client_garage_match` peut échouer si des données incohérentes existent déjà lors d'un UPDATE
- Si des véhicules existent avec `registration` en minuscules, le trigger les normalisera au prochain UPDATE
- L'index unique sur `(garage_id, registration)` peut échouer si des doublons existent déjà (même avec casse différente)
- Le trigger de vérification garage_id s'exécute avant INSERT/UPDATE, donc il empêchera la création/modification de véhicules avec un garage_id incohérent

## 🔧 En cas d'erreur

Si la migration échoue sur le trigger de vérification garage_id (données incohérentes) :

```sql
-- Vérifier les incohérences existantes
SELECT v.id, v.garage_id, v.client_id, c.garage_id as client_garage_id
FROM vehicles v
JOIN clients c ON v.client_id = c.id
WHERE v.garage_id != c.garage_id;

-- Corriger les incohérences AVANT d'appliquer la migration
-- Option 1 : Désactiver temporairement le trigger
ALTER TABLE public.vehicles DISABLE TRIGGER trigger_check_vehicle_client_garage_match;

-- Option 2 : Corriger les données
UPDATE vehicles v
SET garage_id = c.garage_id
FROM clients c
WHERE v.client_id = c.id AND v.garage_id != c.garage_id;

-- Option 3 : Réactiver le trigger après correction
ALTER TABLE public.vehicles ENABLE TRIGGER trigger_check_vehicle_client_garage_match;
```

Si l'index unique échoue (doublons) :

```sql
-- Trouver les doublons
SELECT garage_id, UPPER(TRIM(registration)), COUNT(*)
FROM vehicles
WHERE registration IS NOT NULL AND TRIM(registration) != ''
GROUP BY garage_id, UPPER(TRIM(registration))
HAVING COUNT(*) > 1;

-- Corriger les doublons (exemple : archiver les doublons sauf le plus récent)
-- À adapter selon votre logique métier
```

## ✅ Validation finale

Après application, vérifier que :
- ✅ La table `vehicles` contient la colonne `mileage`
- ✅ L'index unique `idx_vehicles_garage_registration_unique` existe
- ✅ Le trigger `trigger_normalize_vehicle_registration` existe
- ✅ Le trigger `trigger_check_vehicle_client_garage_match` existe
- ✅ Les policies RLS sont actives
- ✅ La fonction `get_client_vehicles()` existe

---

**Fichier de migration** : `supabase/migrations/20260210000012_vehicles_crm_enhancement.sql`
