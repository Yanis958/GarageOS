-- Extension de quotes pour le statut de paiement des factures

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_status text CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS payment_method text;

COMMENT ON COLUMN public.quotes.payment_status IS 'Statut de paiement pour les factures (unpaid, partial, paid)';
COMMENT ON COLUMN public.quotes.payment_date IS 'Date de paiement de la facture';
COMMENT ON COLUMN public.quotes.payment_method IS 'Mode de paiement (ex: "Virement", "Chèque", "Espèces")';
