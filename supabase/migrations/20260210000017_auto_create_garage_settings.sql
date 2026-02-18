-- Migration : Création automatique des garage_settings lors de la création d'un garage
-- Ce trigger garantit qu'une ligne garage_settings est toujours créée quand un garage est créé

-- Fonction pour créer automatiquement les settings par défaut
CREATE OR REPLACE FUNCTION public.create_garage_settings_on_garage_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer les settings par défaut pour le nouveau garage
  INSERT INTO public.garage_settings (
    garage_id,
    vat_rate,
    hourly_rate,
    currency,
    quote_valid_days,
    include_client_explanation_in_email,
    reminders_enabled
  ) VALUES (
    NEW.id,
    20,
    60,
    'EUR',
    30,
    true,
    true
  )
  ON CONFLICT (garage_id) DO NOTHING; -- Ne rien faire si les settings existent déjà
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_create_garage_settings ON public.garages;

-- Créer le trigger qui s'exécute après l'insertion d'un garage
CREATE TRIGGER trigger_create_garage_settings
  AFTER INSERT ON public.garages
  FOR EACH ROW
  EXECUTE FUNCTION public.create_garage_settings_on_garage_insert();

COMMENT ON FUNCTION public.create_garage_settings_on_garage_insert() IS 
  'Crée automatiquement une ligne garage_settings avec des valeurs par défaut lors de la création d''un garage';

COMMENT ON TRIGGER trigger_create_garage_settings ON public.garages IS 
  'Déclenche la création automatique des settings lors de la création d''un garage';
