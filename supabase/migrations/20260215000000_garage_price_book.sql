-- Mémoire de prix par garage : prix préférés pour pièces / main-d'œuvre / forfaits
-- Chaque garage a sa propre mémoire (multi-tenant). Lookup : contextual (véhicule) puis global.

CREATE TABLE IF NOT EXISTS public.garage_price_book (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('part', 'labor', 'forfait')),
  item_key text NOT NULL,
  item_label text,
  vehicle_make text NOT NULL DEFAULT '',
  vehicle_model text NOT NULL DEFAULT '',
  vehicle_trim text,
  last_price numeric NOT NULL CHECK (last_price >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.garage_price_book IS 'Prix préférés par garage pour pièces/main-d''œuvre/forfaits (mémoire de prix)';
COMMENT ON COLUMN public.garage_price_book.item_key IS 'Clé normalisée (lowercase, sans accents, sans ponctuation)';
COMMENT ON COLUMN public.garage_price_book.item_label IS 'Dernier libellé affiché pour info';
COMMENT ON COLUMN public.garage_price_book.vehicle_make IS 'Marque véhicule pour règle contextuelle ; vide = règle globale garage';

CREATE INDEX IF NOT EXISTS idx_garage_price_book_garage_type_key
  ON public.garage_price_book(garage_id, item_type, item_key);

-- Une seule ligne par (garage_id, item_type, item_key, vehicle_make, vehicle_model).
-- Règles globales : vehicle_make et vehicle_model = ''.
CREATE UNIQUE INDEX idx_garage_price_book_unique
  ON public.garage_price_book(garage_id, item_type, item_key, vehicle_make, vehicle_model);

-- RLS : un garage ne peut lire/écrire que ses propres lignes
ALTER TABLE public.garage_price_book ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "garage_price_book_select_own" ON public.garage_price_book;
DROP POLICY IF EXISTS "garage_price_book_insert_own" ON public.garage_price_book;
DROP POLICY IF EXISTS "garage_price_book_update_own" ON public.garage_price_book;
DROP POLICY IF EXISTS "garage_price_book_delete_own" ON public.garage_price_book;

CREATE POLICY "garage_price_book_select_own" ON public.garage_price_book FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));

CREATE POLICY "garage_price_book_insert_own" ON public.garage_price_book FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));

CREATE POLICY "garage_price_book_update_own" ON public.garage_price_book FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));

CREATE POLICY "garage_price_book_delete_own" ON public.garage_price_book FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
