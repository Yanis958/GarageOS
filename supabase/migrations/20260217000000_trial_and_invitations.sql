-- Système d'essai gratuit de 7 jours et invitations à usage unique
-- Pour les garages créés via invitation

-- 1. Ajouter trial_end_date et is_active à la table garages
ALTER TABLE public.garages
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.garages.trial_end_date IS 'Date de fin de l''essai gratuit (créé automatiquement à created_at + 7 jours pour les garages créés via invitation)';
COMMENT ON COLUMN public.garages.is_active IS 'Si false : garage en essai gratuit. Si true : garage payé et actif.';

-- 2. Créer la table invitations (si elle n'existe pas déjà)
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  garage_name text NOT NULL,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token) WHERE used = false;
CREATE INDEX IF NOT EXISTS idx_invitations_used ON public.invitations(used);

COMMENT ON TABLE public.invitations IS 'Liens d''invitation à usage unique pour créer des comptes garage avec essai gratuit';
COMMENT ON COLUMN public.invitations.token IS 'Token unique généré avec crypto.randomUUID() pour le lien d''invitation';
COMMENT ON COLUMN public.invitations.garage_name IS 'Nom du garage à créer lors de l''utilisation de l''invitation';
COMMENT ON COLUMN public.invitations.used IS 'Si true : invitation déjà utilisée';
COMMENT ON COLUMN public.invitations.used_at IS 'Date d''utilisation de l''invitation (NULL si non utilisée)';

-- RLS : Les invitations sont accessibles publiquement pour validation via token
-- Mais seuls les admins peuvent créer et voir toutes les invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Policy : Lecture publique pour validation via token (pour la page /invitation/[token])
-- Permet de lire une invitation par son token pour validation
CREATE POLICY "invitations_select_public" ON public.invitations
  FOR SELECT
  USING (true);

-- Policy : Seuls les admins peuvent créer des invitations
CREATE POLICY "invitations_insert_admin" ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
    )
  );

-- Policy : Mise à jour pour marquer comme utilisée (accessible publiquement pour la création de compte)
-- Mais seulement si l'invitation n'est pas déjà utilisée
CREATE POLICY "invitations_update_mark_used" ON public.invitations
  FOR UPDATE
  USING (used = false)
  WITH CHECK (used = true);
