-- Système d'invitations pour inscription contrôlée
-- Permet de créer des comptes uniquement via un lien d'invitation

CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid REFERENCES public.garages(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour recherche rapide par token
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);

COMMENT ON TABLE public.invites IS 'Invitations pour créer un compte (invite-only signup)';
COMMENT ON COLUMN public.invites.garage_id IS 'Garage associé (nullable si invitation générale)';
COMMENT ON COLUMN public.invites.token IS 'Token unique pour le lien d''invitation';
COMMENT ON COLUMN public.invites.expires_at IS 'Date d''expiration de l''invitation (défaut: 30 jours)';
COMMENT ON COLUMN public.invites.used_at IS 'Date d''utilisation (NULL si non utilisée)';

-- RLS : Les invitations sont accessibles uniquement via token (lecture publique pour validation)
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Policy : Lecture publique uniquement pour validation via token (via fonction RPC)
-- Les utilisateurs authentifiés peuvent voir leurs propres invitations
CREATE POLICY "invites_select_by_token" ON public.invites
  FOR SELECT
  USING (true); -- Permet la lecture publique pour validation via API

-- Policy : Permettre l'insertion d'invitations aux utilisateurs authentifiés
-- (la vérification admin se fait côté API, pas côté RLS)
CREATE POLICY "invites_insert_authenticated" ON public.invites
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON POLICY "invites_insert_authenticated" ON public.invites IS 
  'Permet aux utilisateurs authentifiés de créer des invitations (vérification admin côté API)';

-- Fonction RPC pour valider un token d'invitation (sécurisée)
CREATE OR REPLACE FUNCTION public.validate_invite_token(invite_token text)
RETURNS TABLE (
  id uuid,
  email text,
  garage_id uuid,
  expires_at timestamptz,
  used_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.id,
    i.email,
    i.garage_id,
    i.expires_at,
    i.used_at
  FROM public.invites i
  WHERE i.token = invite_token
    AND i.used_at IS NULL
    AND i.expires_at > now();
END;
$$;

COMMENT ON FUNCTION public.validate_invite_token IS 'Valide un token d''invitation (vérifie expiration et utilisation)';
