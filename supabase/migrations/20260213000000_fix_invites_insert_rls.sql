-- Fix RLS pour permettre l'insertion d'invitations par les utilisateurs authentifiés
-- La création d'invitations se fait via l'API /api/invites/create qui vérifie l'authentification

-- Policy : Permettre l'insertion d'invitations aux utilisateurs authentifiés
-- (la vérification admin se fait côté API, pas côté RLS)
DROP POLICY IF EXISTS "invites_insert_authenticated" ON public.invites;

CREATE POLICY "invites_insert_authenticated" ON public.invites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON POLICY "invites_insert_authenticated" ON public.invites IS 
  'Permet aux utilisateurs authentifiés de créer des invitations (vérification admin côté API)';
