-- ============================================================================
-- SCRIPT COMPLET DE RESTAURATION GARAGEOS
-- ============================================================================
-- Ce script fait 3 choses :
-- 1. Configure les politiques RLS (si nécessaire)
-- 2. Crée/vérifie un garage pour votre utilisateur
-- 3. Restaure des données d'exemple (clients, véhicules, devis avec IA)
-- 
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez TOUT ce script
-- 3. Cliquez sur "Run" (ou Ctrl+Enter)
-- 4. Vérifiez les résultats affichés
-- 5. Retournez dans GarageOS et rafraîchissez
-- ============================================================================

-- ============================================================================
-- PARTIE 1 : CONFIGURATION DES POLITIQUES RLS
-- ============================================================================

-- CLIENTS
DROP POLICY IF EXISTS "Allow authenticated insert clients" ON public.clients;
CREATE POLICY "Allow authenticated insert clients"
ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select clients" ON public.clients;
CREATE POLICY "Allow authenticated select clients"
ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update clients" ON public.clients;
CREATE POLICY "Allow authenticated update clients"
ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete clients" ON public.clients;
CREATE POLICY "Allow authenticated delete clients"
ON public.clients FOR DELETE TO authenticated USING (true);

-- VÉHICULES
DROP POLICY IF EXISTS "Allow authenticated insert vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated insert vehicles"
ON public.vehicles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated select vehicles"
ON public.vehicles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated update vehicles"
ON public.vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated delete vehicles"
ON public.vehicles FOR DELETE TO authenticated USING (true);

-- DEVIS (quotes)
DROP POLICY IF EXISTS "Allow authenticated insert quotes" ON public.quotes;
CREATE POLICY "Allow authenticated insert quotes"
ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select quotes" ON public.quotes;
CREATE POLICY "Allow authenticated select quotes"
ON public.quotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update quotes" ON public.quotes;
CREATE POLICY "Allow authenticated update quotes"
ON public.quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete quotes" ON public.quotes;
CREATE POLICY "Allow authenticated delete quotes"
ON public.quotes FOR DELETE TO authenticated USING (true);

-- LIGNES DE DEVIS (quote_items)
DROP POLICY IF EXISTS "Allow authenticated insert quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated insert quote_items"
ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated select quote_items"
ON public.quote_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated update quote_items"
ON public.quote_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated delete quote_items"
ON public.quote_items FOR DELETE TO authenticated USING (true);

-- GARAGES
DROP POLICY IF EXISTS "Allow authenticated select garages" ON public.garages;
CREATE POLICY "Allow authenticated select garages"
ON public.garages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update garages" ON public.garages;
CREATE POLICY "Allow authenticated update garages"
ON public.garages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated insert garages" ON public.garages;
CREATE POLICY "Allow authenticated insert garages"
ON public.garages FOR INSERT TO authenticated WITH CHECK (true);

-- GARAGE_MEMBERS
DROP POLICY IF EXISTS "Allow authenticated select garage_members" ON public.garage_members;
CREATE POLICY "Allow authenticated select garage_members"
ON public.garage_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert garage_members" ON public.garage_members;
CREATE POLICY "Allow authenticated insert garage_members"
ON public.garage_members FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================================
-- PARTIE 2 : CRÉATION/VÉRIFICATION DU GARAGE
-- ============================================================================

DO $$
DECLARE
  v_user_record RECORD;
  v_garage_id uuid;
  v_linked_count integer := 0;
BEGIN
  -- Vérifier si un garage existe déjà
  SELECT id INTO v_garage_id FROM garages ORDER BY created_at LIMIT 1;
  
  IF v_garage_id IS NULL THEN
    -- Créer un garage par défaut
    INSERT INTO garages (id, name, address, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Mon Garage',
      '123 Rue de la Mécanique, 75000 Paris',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_garage_id;
    
    RAISE NOTICE '✅ Garage créé avec l''ID: %', v_garage_id;
  ELSE
    RAISE NOTICE '✅ Garage existant trouvé avec l''ID: %', v_garage_id;
  END IF;

  -- Lier TOUS les utilisateurs authentifiés au garage
  FOR v_user_record IN 
    SELECT id FROM auth.users ORDER BY created_at
  LOOP
    -- Vérifier si le lien existe déjà
    IF NOT EXISTS (
      SELECT 1 FROM garage_members 
      WHERE garage_id = v_garage_id 
      AND user_id = v_user_record.id
    ) THEN
      -- Créer le lien
      INSERT INTO garage_members (garage_id, user_id, role, created_at)
      VALUES (v_garage_id, v_user_record.id, 'owner', NOW());
      
      v_linked_count := v_linked_count + 1;
      RAISE NOTICE '✅ Utilisateur % lié au garage', v_user_record.id;
    END IF;
  END LOOP;

  IF v_linked_count = 0 THEN
    RAISE NOTICE '✅ Tous les utilisateurs sont déjà liés au garage';
  ELSE
    RAISE NOTICE '✅ % utilisateur(s) lié(s) au garage', v_linked_count;
  END IF;
END $$;

-- ============================================================================
-- PARTIE 3 : RESTAURATION DES DONNÉES
-- ============================================================================

-- Créer des clients d'exemple
INSERT INTO clients (id, garage_id, name, phone, email, notes, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM garages LIMIT 1),
  c.name,
  c.phone,
  c.email,
  c.notes,
  NOW() - (c.days_ago || ' days')::INTERVAL
FROM (VALUES
  ('Martin Dupont', '06 12 34 56 78', 'martin.dupont@email.com', 'Client fidèle depuis 5 ans', 30),
  ('Sophie Bernard', '06 23 45 67 89', 'sophie.bernard@email.com', 'Préfère être contactée par email', 20),
  ('Pierre Moreau', '06 34 56 78 90', 'pierre.moreau@email.com', NULL, 15),
  ('Marie Dubois', '06 45 67 89 01', 'marie.dubois@email.com', 'Véhicule de société', 10),
  ('Jean Lefebvre', '06 56 78 90 12', 'jean.lefebvre@email.com', NULL, 5)
) AS c(name, phone, email, notes, days_ago)
WHERE NOT EXISTS (
  SELECT 1 FROM clients WHERE name = c.name AND garage_id = (SELECT id FROM garages LIMIT 1)
);

-- Créer des véhicules liés aux clients
INSERT INTO vehicles (id, garage_id, client_id, registration, brand, model, year, created_at)
SELECT
  gen_random_uuid(),
  (SELECT id FROM garages LIMIT 1),
  c.id,
  v.registration,
  v.brand,
  v.model,
  v.year,
  NOW() - (v.days_ago || ' days')::INTERVAL
FROM clients c
CROSS JOIN (VALUES
  ('Martin Dupont', 'AB-123-CD', 'Renault', 'Clio', 2020, 25),
  ('Sophie Bernard', 'EF-456-GH', 'Peugeot', '208', 2019, 18),
  ('Pierre Moreau', 'IJ-789-KL', 'Citroën', 'C3', 2021, 12),
  ('Marie Dubois', 'MN-012-OP', 'Volkswagen', 'Golf', 2018, 8),
  ('Jean Lefebvre', 'QR-345-ST', 'Ford', 'Fiesta', 2022, 3)
) AS v(client_name, registration, brand, model, year, days_ago)
WHERE c.name = v.client_name
  AND c.garage_id = (SELECT id FROM garages LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM vehicles WHERE registration = v.registration AND garage_id = (SELECT id FROM garages LIMIT 1)
  );

-- Créer des devis avec lignes générées par IA (simulées)
DO $$
DECLARE
  v_garage_id uuid;
  v_client_id uuid;
  v_vehicle_id uuid;
  v_quote_id uuid;
  v_total_ht numeric;
  v_total_ttc numeric;
BEGIN
  v_garage_id := (SELECT id FROM garages LIMIT 1);
  
  -- Devis 1 : Clio - Vidange + Plaquettes (Accepté) - Généré par IA
  SELECT id INTO v_client_id FROM clients WHERE name = 'Martin Dupont' AND garage_id = v_garage_id LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE registration = 'AB-123-CD' AND garage_id = v_garage_id LIMIT 1;
  
  IF v_client_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_total_ht := 45.00 + 120.00 + 25.00;
    v_total_ttc := ROUND(v_total_ht * 1.20, 2);
    
    INSERT INTO quotes (id, garage_id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at)
    VALUES (
      gen_random_uuid(),
      v_garage_id,
      v_client_id,
      v_vehicle_id,
      'accepted',
      'DEV-2026-001',
      (NOW() + INTERVAL '30 days')::date,
      v_total_ht,
      v_total_ttc,
      NOW() - INTERVAL '25 days'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_quote_id;
    
    IF v_quote_id IS NOT NULL THEN
      INSERT INTO quote_items (id, quote_id, label, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Huile moteur 5W30', 'Huile moteur 5W30 – 5L (norme constructeur Renault RN0700)', 1, 45.00, 45.00, 'part', NOW() - INTERVAL '25 days'),
        (gen_random_uuid(), v_quote_id, 'Plaquettes frein avant', 'Plaquettes de frein avant – Kit complet (marque référence)', 1, 120.00, 120.00, 'part', NOW() - INTERVAL '25 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre', 'Main-d''œuvre – Remplacement plaquettes avant + vidange moteur', 0.5, 50.00, 25.00, 'labor', NOW() - INTERVAL '25 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Devis 2 : Peugeot 208 - Révision complète (Envoyé) - Généré par IA
  SELECT id INTO v_client_id FROM clients WHERE name = 'Sophie Bernard' AND garage_id = v_garage_id LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE registration = 'EF-456-GH' AND garage_id = v_garage_id LIMIT 1;
  
  IF v_client_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_total_ht := 15.00 + 12.00 + 35.00 + 75.00;
    v_total_ttc := ROUND(v_total_ht * 1.20, 2);
    
    INSERT INTO quotes (id, garage_id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at)
    VALUES (
      gen_random_uuid(),
      v_garage_id,
      v_client_id,
      v_vehicle_id,
      'sent',
      'DEV-2026-002',
      (NOW() + INTERVAL '20 days')::date,
      v_total_ht,
      v_total_ttc,
      NOW() - INTERVAL '18 days'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_quote_id;
    
    IF v_quote_id IS NOT NULL THEN
      INSERT INTO quote_items (id, quote_id, label, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Filtre à huile', 'Filtre à huile – Référence constructeur', 1, 15.00, 15.00, 'part', NOW() - INTERVAL '18 days'),
        (gen_random_uuid(), v_quote_id, 'Filtre à air', 'Filtre à air – Référence constructeur', 1, 12.00, 12.00, 'part', NOW() - INTERVAL '18 days'),
        (gen_random_uuid(), v_quote_id, 'Bougies d''allumage', 'Bougies d''allumage – Kit 4 pièces', 1, 35.00, 35.00, 'part', NOW() - INTERVAL '18 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre révision', 'Main-d''œuvre – Révision complète (vidange, filtres, bougies)', 1.5, 50.00, 75.00, 'labor', NOW() - INTERVAL '18 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Devis 3 : Citroën C3 - Réparation freinage (Brouillon avec IA)
  SELECT id INTO v_client_id FROM clients WHERE name = 'Pierre Moreau' AND garage_id = v_garage_id LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE registration = 'IJ-789-KL' AND garage_id = v_garage_id LIMIT 1;
  
  IF v_client_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_total_ht := 85.00 + 50.00;
    v_total_ttc := ROUND(v_total_ht * 1.20, 2);
    
    INSERT INTO quotes (id, garage_id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at)
    VALUES (
      gen_random_uuid(),
      v_garage_id,
      v_client_id,
      v_vehicle_id,
      'draft',
      'DEV-2026-003',
      (NOW() + INTERVAL '30 days')::date,
      v_total_ht,
      v_total_ttc,
      NOW() - INTERVAL '12 days'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_quote_id;
    
    IF v_quote_id IS NOT NULL THEN
      INSERT INTO quote_items (id, quote_id, label, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Disques frein avant', 'Disques de frein avant – Paire (marque référence)', 1, 85.00, 85.00, 'part', NOW() - INTERVAL '12 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre', 'Main-d''œuvre – Remplacement disques de frein avant', 1.0, 50.00, 50.00, 'labor', NOW() - INTERVAL '12 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Devis 4 : Golf - Contrôle technique + Réparations (Brouillon avec IA)
  SELECT id INTO v_client_id FROM clients WHERE name = 'Marie Dubois' AND garage_id = v_garage_id LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE registration = 'MN-012-OP' AND garage_id = v_garage_id LIMIT 1;
  
  IF v_client_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_total_ht := 12.50 + 12.50 + 0.00 + 25.00;
    v_total_ttc := ROUND(v_total_ht * 1.20, 2);
    
    INSERT INTO quotes (id, garage_id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at)
    VALUES (
      gen_random_uuid(),
      v_garage_id,
      v_client_id,
      v_vehicle_id,
      'draft',
      'DEV-2026-004',
      (NOW() + INTERVAL '30 days')::date,
      v_total_ht,
      v_total_ttc,
      NOW() - INTERVAL '8 days'
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_quote_id;
    
    IF v_quote_id IS NOT NULL THEN
      INSERT INTO quote_items (id, quote_id, label, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Ampoule phare droit', 'Ampoule phare avant droit – H7 12V 55W', 1, 12.50, 12.50, 'part', NOW() - INTERVAL '8 days'),
        (gen_random_uuid(), v_quote_id, 'Ampoule phare gauche', 'Ampoule phare avant gauche – H7 12V 55W', 1, 12.50, 12.50, 'part', NOW() - INTERVAL '8 days'),
        (gen_random_uuid(), v_quote_id, 'Contrôle visuel', 'Contrôle visuel de sécurité – Inspection complète (inclus)', 1, 0.00, 0.00, 'forfait', NOW() - INTERVAL '8 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre', 'Main-d''œuvre – Remplacement ampoules + contrôle', 0.5, 50.00, 25.00, 'labor', NOW() - INTERVAL '8 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RAISE NOTICE '✅ Devis créés avec succès';
END $$;

-- ============================================================================
-- VÉRIFICATION FINALE
-- ============================================================================

SELECT 
  '📊 RÉSUMÉ DES DONNÉES RESTAURÉES' AS type,
  '' AS valeur
UNION ALL
SELECT 
  'Garage',
  (SELECT name FROM garages LIMIT 1) || ' (ID: ' || (SELECT id FROM garages LIMIT 1)::text || ')'
UNION ALL
SELECT 
  'Clients créés',
  COUNT(*)::text
FROM clients
WHERE garage_id = (SELECT id FROM garages LIMIT 1)
UNION ALL
SELECT 
  'Véhicules créés',
  COUNT(*)::text
FROM vehicles
WHERE garage_id = (SELECT id FROM garages LIMIT 1)
UNION ALL
SELECT 
  'Devis créés',
  COUNT(*)::text
FROM quotes
WHERE garage_id = (SELECT id FROM garages LIMIT 1)
UNION ALL
SELECT 
  'Lignes de devis créées',
  COUNT(*)::text
FROM quote_items
WHERE quote_id IN (SELECT id FROM quotes WHERE garage_id = (SELECT id FROM garages LIMIT 1));
