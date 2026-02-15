-- Migration : Ajouter les champs professionnels à quote_items
-- À exécuter dans Supabase : SQL Editor > New query > Coller > Run

-- Ajouter les colonnes pour les lignes optionnelles, estimations, notes de prix, et champs internes
ALTER TABLE public.quote_items 
  ADD COLUMN IF NOT EXISTS optional boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS optional_reason text,
  ADD COLUMN IF NOT EXISTS estimated_range text,
  ADD COLUMN IF NOT EXISTS pricing_note text,
  ADD COLUMN IF NOT EXISTS cost_price_ht numeric,
  ADD COLUMN IF NOT EXISTS margin_ht numeric;

-- Commentaires pour documentation
COMMENT ON COLUMN public.quote_items.optional IS 'Indique si la ligne est optionnelle (peut être retirée du devis)';
COMMENT ON COLUMN public.quote_items.optional_reason IS 'Raison pour laquelle la ligne est optionnelle';
COMMENT ON COLUMN public.quote_items.estimated_range IS 'Plage d''estimation pour main-d''œuvre (ex: "8-12h")';
COMMENT ON COLUMN public.quote_items.pricing_note IS 'Note si le prix n''est pas défini (ex: "À définir selon disponibilité")';
COMMENT ON COLUMN public.quote_items.cost_price_ht IS 'Prix de revient HT (champ interne, non visible sur PDF)';
COMMENT ON COLUMN public.quote_items.margin_ht IS 'Marge HT calculée (champ interne, non visible sur PDF)';
