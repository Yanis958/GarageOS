-- Extension de clients pour les adresses complètes dans les PDF

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text;

COMMENT ON COLUMN public.clients.address IS 'Adresse complète du client (ligne 1)';
COMMENT ON COLUMN public.clients.address_line2 IS 'Complément d''adresse (ligne 2)';
COMMENT ON COLUMN public.clients.postal_code IS 'Code postal';
COMMENT ON COLUMN public.clients.city IS 'Ville';
