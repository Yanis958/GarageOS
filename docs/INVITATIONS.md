# Système d'invitations GarageOS

## Vue d'ensemble

Le système d'invitations permet de contrôler l'inscription des nouveaux utilisateurs. Par défaut, l'inscription publique est désactivée et seuls les utilisateurs avec un lien d'invitation peuvent créer un compte.

## Configuration

### Variable d'environnement

Pour activer l'inscription publique (désactivée par défaut), ajoutez dans `.env.local` :

```bash
NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP=true
```

Sans cette variable, seuls les utilisateurs avec un lien d'invitation peuvent s'inscrire.

## Créer une invitation

### Méthode 1 : Via l'API (recommandé)

```bash
curl -X POST http://localhost:3000/api/invites/create \
  -H "Content-Type: application/json" \
  -H "Cookie: votre-session-cookie" \
  -d '{
    "email": "nouveau@garage.com",
    "garage_id": "uuid-du-garage",  # Optionnel
    "expires_in_days": 30
  }'
```

La réponse contient :
- `invite_url` : Le lien à envoyer à l'utilisateur
- `token` : Le token d'invitation
- `expires_at` : Date d'expiration

### Méthode 2 : Via SQL (Supabase Dashboard)

```sql
INSERT INTO public.invites (email, token, garage_id, expires_at)
VALUES (
  'nouveau@garage.com',
  gen_random_uuid()::text || gen_random_uuid()::text,  -- Token unique
  'uuid-du-garage',  -- Optionnel
  now() + interval '30 days'
)
RETURNING 
  id,
  email,
  token,
  'https://ton-domaine.com/invite?token=' || token as invite_url;
```

## Flow d'inscription

1. **Admin crée une invitation** → Génère un lien unique
2. **Admin envoie le lien** → Email, SMS, etc.
3. **Utilisateur clique sur le lien** → `/invite?token=XXXX`
4. **Page `/invite` valide le token** → Vérifie expiration et utilisation
5. **Utilisateur remplit le formulaire** → Email pré-rempli, mot de passe
6. **Compte créé** → Utilisateur lié au garage (si `garage_id` fourni)
7. **Invitation marquée comme utilisée** → Ne peut plus être réutilisée

## Structure de la table `invites`

```sql
CREATE TABLE public.invites (
  id uuid PRIMARY KEY,
  garage_id uuid REFERENCES garages(id),  -- Optionnel
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,  -- NULL = non utilisée
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
```

## Sécurité

- Les tokens sont uniques et non prévisibles (32 bytes hex)
- Les invitations expirent après 30 jours par défaut
- Une invitation ne peut être utilisée qu'une seule fois
- RLS activée : lecture publique pour validation, création via API uniquement

## Pages créées

- `/login` : Page de connexion premium avec design moderne
- `/invite` : Page d'acceptation d'invitation
- `/auth/reset-password` : Réinitialisation de mot de passe

## Routes API

- `GET /api/invites/validate?token=XXX` : Valide un token d'invitation
- `POST /api/invites/use` : Marque une invitation comme utilisée et lie l'utilisateur au garage
- `POST /api/invites/create` : Crée une nouvelle invitation (admin)

## Notes

- Si `garage_id` est fourni lors de la création de l'invitation, l'utilisateur sera automatiquement lié au garage avec le rôle `owner`
- Si `garage_id` est `NULL`, l'utilisateur devra créer son garage via `/onboarding` après inscription
- Les messages d'erreur sont en français et lisibles pour l'utilisateur final
