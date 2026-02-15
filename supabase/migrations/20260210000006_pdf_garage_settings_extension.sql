-- Extension de garage_settings pour la personnalisation PDF
-- Ajout des champs nécessaires pour la génération de PDF professionnels multi-tenant

ALTER TABLE public.garage_settings
  ADD COLUMN IF NOT EXISTS vat_intracom text,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS payment_delay_days int,
  ADD COLUMN IF NOT EXISTS legal_mentions text,
  ADD COLUMN IF NOT EXISTS late_payment_penalties text,
  ADD COLUMN IF NOT EXISTS invoice_prefix text NOT NULL DEFAULT 'F',
  ADD COLUMN IF NOT EXISTS credit_note_prefix text NOT NULL DEFAULT 'AV';

COMMENT ON COLUMN public.garage_settings.vat_intracom IS 'TVA intracommunautaire (ex: FR12345678901)';
COMMENT ON COLUMN public.garage_settings.payment_terms IS 'Conditions de paiement (ex: "30 jours net", "Chèque", "Virement")';
COMMENT ON COLUMN public.garage_settings.payment_delay_days IS 'Délai de règlement en jours (ex: 30)';
COMMENT ON COLUMN public.garage_settings.legal_mentions IS 'Mentions légales personnalisées pour les PDF';
COMMENT ON COLUMN public.garage_settings.late_payment_penalties IS 'Pénalités de retard (ex: "3 fois le taux légal")';
COMMENT ON COLUMN public.garage_settings.invoice_prefix IS 'Préfixe pour les numéros de facture (ex: "F")';
COMMENT ON COLUMN public.garage_settings.credit_note_prefix IS 'Préfixe pour les numéros d''avoir (ex: "AV")';
