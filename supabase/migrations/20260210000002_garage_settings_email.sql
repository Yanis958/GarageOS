-- Sujet email et option explication client IA pour les devis envoyés par email
ALTER TABLE public.garage_settings
  ADD COLUMN IF NOT EXISTS email_subject text DEFAULT 'Votre devis - {reference}',
  ADD COLUMN IF NOT EXISTS include_client_explanation_in_email boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.garage_settings.email_subject IS 'Modèle de sujet des emails de devis ; {reference} est remplacé par la référence du devis';
COMMENT ON COLUMN public.garage_settings.include_client_explanation_in_email IS 'Si true, inclure l''explication client (IA) dans le corps de l''email quand elle est générée';
