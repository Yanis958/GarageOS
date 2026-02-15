# Audit RLS & Multi-tenant GarageOS

## Tables avec `garage_id` (isolation par garage)

| Table | garage_id | RLS activé | Policies |
|-------|-----------|------------|---------|
| **garages** | `id` (PK) | Oui | SELECT/UPDATE : `id IN (current_user_garage_ids())` ; Admin : SELECT tous |
| **garage_members** | oui | Oui | SELECT/INSERT/UPDATE/DELETE : `garage_id IN (current_user_garage_ids())` |
| **garage_settings** | PK | Oui | SELECT/INSERT/UPDATE : idem ; Admin : SELECT/UPDATE |
| **garage_feature_flags** | oui | Oui | SELECT : membre garage OU admin ; INSERT/UPDATE/DELETE : admin uniquement |
| **clients** | oui | Oui | SELECT/INSERT/UPDATE/DELETE : `garage_id IN (current_user_garage_ids())` |
| **vehicles** | oui | Oui | Idem |
| **quotes** | oui | Oui | Idem |
| **quote_items** | oui | Oui | Idem |
| **credit_notes** | oui | Oui | Idem |
| **credit_note_items** | oui | Oui | Idem |
| **quick_tasks** | oui | Oui | Idem |
| **planning_assignments** | oui | Oui | Idem |
| **garage_tasks** | oui | Oui | Idem |
| **ai_usage** | oui | Oui | SELECT : membre garage OU admin ; INSERT/UPDATE : **à durcir** → `garage_id IN (current_user_garage_ids())` |
| **ai_events** | oui | Oui | INSERT : **à durcir** → `garage_id IN (current_user_garage_ids())` ; SELECT : admin uniquement |

## Tables sans `garage_id` (plateforme)

| Table | RLS | Policies |
|-------|-----|----------|
| **admin_users** | Oui | SELECT : `auth.uid() = user_id` (voir si je suis admin) |
| **admin_audit_log** | Oui | INSERT : authenticated ; SELECT : admin uniquement |

## Rôle garage : `garage_members.role`

- **Actuel :** `owner` | `manager` | `staff`
- **Cible :** `owner` | `staff` uniquement (suppression de `manager` ; migrer les `manager` en `staff`)

## Admin plateforme

- **Table :** `admin_users(user_id)` — présence = accès menu Admin et actions admin.
- Menu « Admin » : déjà conditionné par `isAdmin()` (sidebar) ; aucun changement nécessaire.

## Policies à créer / corriger (résumé)

1. **ai_usage**  
   - Remplacer `INSERT/UPDATE WITH CHECK (true)` par  
     `WITH CHECK (garage_id IN (SELECT current_user_garage_ids()))`.

2. **ai_events**  
   - Remplacer `INSERT WITH CHECK (true)` par  
     `WITH CHECK (garage_id IN (SELECT current_user_garage_ids()))`.

3. **garage_members**  
   - Contrainte role : `CHECK (role IN ('owner', 'staff'))`.  
   - Migration : `UPDATE garage_members SET role = 'staff' WHERE role = 'manager'`.

Aucune autre table métier ne nécessite d’ajout de `garage_id` ; les tables listées ci-dessus couvrent le périmètre.
