-- Table credit_notes (avoirs) et credit_note_items pour la gestion des avoirs

-- Table principale des avoirs
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  reference text NOT NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('draft', 'sent', 'accepted')),
  total_ht numeric NOT NULL DEFAULT 0,
  total_tva numeric NOT NULL DEFAULT 0,
  total_ttc numeric NOT NULL DEFAULT 0,
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  notes_client text,
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_garage ON public.credit_notes(garage_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_client ON public.credit_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_quote ON public.credit_notes(quote_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON public.credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_archived ON public.credit_notes(archived_at);

COMMENT ON TABLE public.credit_notes IS 'Avoirs (notes de crédit) émis par le garage';
COMMENT ON COLUMN public.credit_notes.quote_id IS 'Facture liée si l''avoir est lié à une facture spécifique';

-- Table des lignes d'avoir
CREATE TABLE IF NOT EXISTS public.credit_note_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id uuid NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('labor', 'part', 'forfait')),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_note_items_credit_note ON public.credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_garage ON public.credit_note_items(garage_id);

COMMENT ON TABLE public.credit_note_items IS 'Lignes d''intervention pour les avoirs';

-- RLS pour credit_notes
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_notes_select_own" ON public.credit_notes;
DROP POLICY IF EXISTS "credit_notes_insert_own" ON public.credit_notes;
DROP POLICY IF EXISTS "credit_notes_update_own" ON public.credit_notes;
DROP POLICY IF EXISTS "credit_notes_delete_own" ON public.credit_notes;

CREATE POLICY "credit_notes_select_own" ON public.credit_notes FOR SELECT TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));

CREATE POLICY "credit_notes_insert_own" ON public.credit_notes FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));

CREATE POLICY "credit_notes_update_own" ON public.credit_notes FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()))
  WITH CHECK (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));

CREATE POLICY "credit_notes_delete_own" ON public.credit_notes FOR DELETE TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));

-- RLS pour credit_note_items
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_note_items_select_own" ON public.credit_note_items;
DROP POLICY IF EXISTS "credit_note_items_insert_own" ON public.credit_note_items;
DROP POLICY IF EXISTS "credit_note_items_update_own" ON public.credit_note_items;
DROP POLICY IF EXISTS "credit_note_items_delete_own" ON public.credit_note_items;

CREATE POLICY "credit_note_items_select_own" ON public.credit_note_items FOR SELECT TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));

CREATE POLICY "credit_note_items_insert_own" ON public.credit_note_items FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));

CREATE POLICY "credit_note_items_update_own" ON public.credit_note_items FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()))
  WITH CHECK (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));

CREATE POLICY "credit_note_items_delete_own" ON public.credit_note_items FOR DELETE TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));
