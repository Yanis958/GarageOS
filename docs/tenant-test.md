# Test d’isolation multi-tenant (Garage A / Garage B)

Cette procédure permet de vérifier qu’aucune donnée d’un garage n’est visible par un utilisateur d’un autre garage (isolation RLS).

## Prérequis

- Migrations Supabase appliquées (notamment `20260210000000_garage_multi_tenant.sql`, `20260210000001_rls_garage.sql`, `20260210000004_phase1_verrouillage.sql`).
- Deux comptes utilisateur (auth.users) et deux garages avec des membres distincts.

## 1. Appliquer les migrations

Dans le projet Supabase (Dashboard → SQL Editor), exécuter dans l’ordre :

1. `20260210000000_garage_multi_tenant.sql`
2. `20260210000001_rls_garage.sql`
3. `20260210000004_phase1_verrouillage.sql`

(et les autres migrations existantes si nécessaire.)

## 2. Créer deux garages et deux utilisateurs

- **Garage A** : créer un garage (table `garages`), un utilisateur (auth), un enregistrement dans `garage_members` (user_id → garage A).
- **Garage B** : idem (autre garage, autre utilisateur, membre du garage B uniquement).

Exemple SQL (après avoir créé les utilisateurs dans Auth) :

```sql
-- Exemple : après création de user_a et user_b dans Supabase Auth
INSERT INTO public.garages (id, name, slug, address) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Garage A', 'garage-a', '1 rue A'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Garage B', 'garage-b', '2 rue B');

INSERT INTO public.garage_members (garage_id, user_id, role) VALUES
  ('aaaaaaaa-0000-0000-0000-0000-000000000001', 'USER_A_UUID', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'USER_B_UUID', 'owner');
```

## 3. Insérer des données de test

Pour chaque table métier, insérer des lignes avec `garage_id` du garage A et d’autres avec `garage_id` du garage B (ex. `clients`, `vehicles`, `quotes`, `quote_items`, `quick_tasks`, `planning_assignments`). Ainsi chaque garage a des données qui ne doivent pas être vues par l’autre.

Exemple :

```sql
INSERT INTO public.clients (id, garage_id, name, email) VALUES
  (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 'Client Garage A', 'a@test.local'),
  (gen_random_uuid(), 'bbbbbbbb-0000-0000-0000-000000000002', 'Client Garage B', 'b@test.local');
```

## 4. Vérifier l’isolation

### Option A : Requêtes manuelles dans Supabase (SQL Editor)

Supabase ne permet pas facilement d’exécuter du SQL “en tant que” tel ou tel utilisateur. Pour simuler :

- Utiliser l’application : se connecter comme **utilisateur A**, aller sur les pages qui listent clients, devis, etc. Noter les IDs/noms visibles. Se déconnecter, se connecter comme **utilisateur B** : les données du garage A ne doivent **jamais** apparaître (listes, formulaires, détails).
- Vérifier qu’aucun ID de ligne appartenant au garage A (ex. `client.id` ou `quote.id` insérés pour garage A) n’apparaît dans l’interface quand on est connecté en tant qu’utilisateur B.

### Option B : Route dev (résumé des données par garage)

En développement (`NODE_ENV=development`), une route permet d’obtenir un résumé des lignes par table et par `garage_id` (sans vérifier RLS, car elle utilise le service role ou l’admin) :

- `GET /api/dev/tenant-isolation` (voir section 5)

Cela aide à confirmer que les données de test sont bien réparties entre les deux garages. La garantie RLS se fait en testant l’app avec deux comptes (option A).

### Option C : Script d’isolation (si implémenté)

Si un script Node/TS est ajouté au dépôt (ex. `scripts/tenant-isolation-test.ts`) :

1. Configurer deux utilisateurs de test (email/mot de passe) dans `.env.test` ou variables d’environnement.
2. Exécuter : `npx ts-node scripts/tenant-isolation-test.ts` (ou équivalent).
3. Le script se connecte successivement avec le compte garage A et le compte garage B, interroge chaque table (clients, vehicles, quotes, quote_items, quick_tasks, planning_assignments) et vérifie qu’aucune ligne ne contient le `garage_id` de l’autre garage.
4. Résultat attendu : 0 ligne « croisée » pour chaque table.

## 5. Route dev `GET /api/dev/tenant-isolation`

- **En production** : la route renvoie 404.
- **En développement** : la route renvoie un JSON listant pour chaque table métier le nombre de lignes par `garage_id`. Utile pour s’assurer que les données de test sont bien réparties avant de tester l’isolation côté interface ou script.

Ne pas exposer cette route en production (elle est désactivée si `NODE_ENV !== 'development'`).

## Résultat attendu

- Aucune donnée du **garage A** n’apparaît lorsque l’on utilise l’application (ou les requêtes) en tant qu’utilisateur du **garage B**, et réciproquement.
- En particulier : listes (clients, véhicules, devis, tâches, créneaux planning), fiches détail et formulaires ne doivent jamais afficher ou modifier des enregistrements de l’autre garage.
