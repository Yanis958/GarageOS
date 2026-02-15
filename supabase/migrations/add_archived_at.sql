-- Migration : soft delete (archivage)
-- À appliquer manuellement dans Supabase (SQL Editor). Ne pas exécuter automatiquement.
-- Ajoute archived_at (et optionnellement archived_by) sur clients, vehicles, quotes.

-- Clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

-- Véhicules
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

-- Devis (quotes)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS archived_by uuid NULL;

-- Index optionnels pour filtrer rapidement les actifs/archivés
CREATE INDEX IF NOT EXISTS idx_clients_archived_at ON public.clients (archived_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_archived_at ON public.vehicles (archived_at);
CREATE INDEX IF NOT EXISTS idx_quotes_archived_at ON public.quotes (archived_at);
