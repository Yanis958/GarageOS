-- Multi-tenant: garages slug, garage_members role, garage_settings, quote_items.garage_id
-- Apply after base schema (garages, garage_members, clients, vehicles, quotes, quote_items exist).

-- 1. garages: add slug (nullable for backfill, then can be set and enforced NOT NULL later)
ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS slug text UNIQUE;

-- 2. garage_members: ensure role column and constraint exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'garage_members' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.garage_members ADD COLUMN role text NOT NULL DEFAULT 'staff';
  END IF;
END $$;
ALTER TABLE public.garage_members DROP CONSTRAINT IF EXISTS garage_members_role_check;
ALTER TABLE public.garage_members ADD CONSTRAINT garage_members_role_check CHECK (role IN ('owner', 'manager', 'staff'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_garage_members_garage_user ON public.garage_members(garage_id, user_id);

-- 3. garage_settings (1 row per garage)
CREATE TABLE IF NOT EXISTS public.garage_settings (
  garage_id uuid PRIMARY KEY REFERENCES public.garages(id) ON DELETE CASCADE,
  logo_url text,
  phone text,
  email text,
  address text,
  siret text,
  vat_rate numeric NOT NULL DEFAULT 20,
  hourly_rate numeric NOT NULL DEFAULT 60,
  currency text NOT NULL DEFAULT 'EUR',
  quote_valid_days int NOT NULL DEFAULT 30,
  pdf_footer text,
  email_signature text,
  primary_color text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_garage_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_garage_settings_updated_at ON public.garage_settings;
CREATE TRIGGER trigger_garage_settings_updated_at
  BEFORE UPDATE ON public.garage_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_garage_settings_updated_at();

COMMENT ON TABLE public.garage_settings IS 'Paramètres par garage (logo, TVA, taux horaire, validité devis, etc.)';

-- 4. quote_items: add garage_id (nullable, backfill from quotes, then NOT NULL)
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS garage_id uuid REFERENCES public.garages(id);

UPDATE public.quote_items qi
SET garage_id = q.garage_id
FROM public.quotes q
WHERE qi.quote_id = q.id AND qi.garage_id IS NULL;

-- Supprimer les lignes orphelines (devis supprimés) avant de rendre garage_id NOT NULL
DELETE FROM public.quote_items WHERE garage_id IS NULL;

ALTER TABLE public.quote_items ALTER COLUMN garage_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_garage_id ON public.quote_items(garage_id);
