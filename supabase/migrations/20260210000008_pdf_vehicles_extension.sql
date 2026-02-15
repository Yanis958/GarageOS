-- Extension de vehicles pour le numéro VIN dans les PDF

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vin text;

COMMENT ON COLUMN public.vehicles.vin IS 'Numéro VIN du véhicule (Vehicle Identification Number)';
