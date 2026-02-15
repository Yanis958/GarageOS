# Checklist vérification multi-tenant GarageOS

## 1. RLS et isolation

- [ ] Appliquer la migration `20260210000013_rls_platform_hardening.sql` (ai_usage, ai_events, role owner|staff).
- [ ] Vérifier qu’un user A (membre du garage 1) ne peut pas lire/écrire les données du garage 2 : en SQL ou via l’app, tenter un SELECT/UPDATE sur `clients`, `quotes`, `vehicles` avec un `garage_id` différent → doit être vide ou refusé.
- [ ] Vérifier que `current_user_garage_ids()` retourne uniquement les garages de l’utilisateur connecté (via `garage_members`).

## 2. Onboarding

- [ ] Se connecter avec un compte qui n’a aucun enregistrement dans `garage_members` → redirection vers `/onboarding`.
- [ ] Sur « Créer mon garage », remplir le nom, soumettre → création d’un garage, d’un lien `garage_members` (role owner), d’une ligne `garage_settings`, des lignes `garage_feature_flags` par défaut, puis redirection vers `/dashboard`.
- [ ] Après création, le dashboard s’affiche avec le bon garage (pas de chute ni d’erreur).

## 3. Admin plateforme

- [ ] Menu « Admin » visible uniquement pour les utilisateurs présents dans `admin_users`.
- [ ] Un utilisateur « garage » (non présent dans `admin_users`) ne voit pas le lien Admin dans la sidebar.

## 4. Helpers

- [ ] `getCurrentGarageId()` retourne `null` si l’utilisateur n’est dans aucun garage (pas de fallback sur un autre garage).
- [ ] `getCurrentGarageWithSettings()` utilisé dans le layout dashboard ; si `null`, redirection vers `/onboarding`.
- [ ] `hasFeature("ai_copilot")` (ou autre clé) reflète bien la valeur dans `garage_feature_flags` pour le garage courant.
- [ ] `getGarageSettings()` retourne les paramètres du garage courant (ou null).

## 5. Non-régression

- [ ] Pages Devis, Factures, Clients, Véhicules : pas de régression (liste, détail, création, édition).
- [ ] Aucune modification de la logique métier existante (uniquement couche plateforme / RLS / onboarding / helpers).
