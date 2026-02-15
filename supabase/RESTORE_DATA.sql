-- ============================================================================
-- SCRIPT DE RESTAURATION DES DONNÉES GARAGEOS
-- ============================================================================
-- Ce script restaure des données d'exemple (clients, véhicules, devis avec IA)
-- 
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez ce script complet
-- 3. Exécutez-le
-- 4. Vérifiez que les données apparaissent dans votre application
-- ============================================================================

-- Étape 1: Vérifier/créer un garage pour l'utilisateur connecté
DO $$
DECLARE
  v_user_id uuid;
  v_garage_id uuid;
BEGIN
  -- Récupérer le premier utilisateur authentifié
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Aucun utilisateur trouvé. Connectez-vous d''abord à l''application.';
  END IF;

  -- Vérifier si un garage existe déjà
  SELECT id INTO v_garage_id FROM garages LIMIT 1;
  
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
    
    -- Créer le lien garage_members (nécessaire pour RLS)
    INSERT INTO garage_members (garage_id, user_id, role, created_at)
    VALUES (v_garage_id, v_user_id, 'owner', NOW())
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE '✅ Garage créé avec l''ID: %', v_garage_id;
  ELSE
    RAISE NOTICE '✅ Garage existant trouvé avec l''ID: %', v_garage_id;
  END IF;
END $$;

-- Étape 2: Créer des clients d'exemple
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

-- Étape 3: Créer des véhicules liés aux clients
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

-- Étape 4: Créer des devis avec lignes générées par IA (simulées)
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
    v_total_ht := 45.00 + 120.00 + 25.00; -- Huile + Plaquettes + Main-d'œuvre
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
      -- Lignes du devis (simulant une génération IA avec format professionnel)
      INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Huile moteur 5W30 – 5L (norme constructeur Renault RN0700)', 1, 45.00, 45.00, 'part', NOW() - INTERVAL '25 days'),
        (gen_random_uuid(), v_quote_id, 'Plaquettes de frein avant – Kit complet (marque référence)', 1, 120.00, 120.00, 'part', NOW() - INTERVAL '25 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre – Remplacement plaquettes avant + vidange moteur', 0.5, 50.00, 25.00, 'labor', NOW() - INTERVAL '25 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Devis 2 : Peugeot 208 - Révision complète (Envoyé) - Généré par IA
  SELECT id INTO v_client_id FROM clients WHERE name = 'Sophie Bernard' AND garage_id = v_garage_id LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE registration = 'EF-456-GH' AND garage_id = v_garage_id LIMIT 1;
  
  IF v_client_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_total_ht := 15.00 + 12.00 + 35.00 + 75.00; -- Filtres + Bougies + Main-d'œuvre
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
      INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Filtre à huile – Référence constructeur', 1, 15.00, 15.00, 'part', NOW() - INTERVAL '18 days'),
        (gen_random_uuid(), v_quote_id, 'Filtre à air – Référence constructeur', 1, 12.00, 12.00, 'part', NOW() - INTERVAL '18 days'),
        (gen_random_uuid(), v_quote_id, 'Bougies d''allumage – Kit 4 pièces', 1, 35.00, 35.00, 'part', NOW() - INTERVAL '18 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre – Révision complète (vidange, filtres, bougies)', 1.5, 50.00, 75.00, 'labor', NOW() - INTERVAL '18 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Devis 3 : Citroën C3 - Réparation freinage (Brouillon avec IA)
  SELECT id INTO v_client_id FROM clients WHERE name = 'Pierre Moreau' AND garage_id = v_garage_id LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE registration = 'IJ-789-KL' AND garage_id = v_garage_id LIMIT 1;
  
  IF v_client_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_total_ht := 85.00 + 50.00; -- Disques + Main-d'œuvre
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
      INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Disques de frein avant – Paire (marque référence)', 1, 85.00, 85.00, 'part', NOW() - INTERVAL '12 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre – Remplacement disques de frein avant', 1.0, 50.00, 50.00, 'labor', NOW() - INTERVAL '12 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  -- Devis 4 : Golf - Contrôle technique + Réparations (Brouillon avec IA)
  SELECT id INTO v_client_id FROM clients WHERE name = 'Marie Dubois' AND garage_id = v_garage_id LIMIT 1;
  SELECT id INTO v_vehicle_id FROM vehicles WHERE registration = 'MN-012-OP' AND garage_id = v_garage_id LIMIT 1;
  
  IF v_client_id IS NOT NULL AND v_vehicle_id IS NOT NULL THEN
    v_total_ht := 12.50 + 12.50 + 0.00 + 25.00; -- Ampoules + Contrôle visuel (inclus) + Main-d'œuvre
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
      INSERT INTO quote_items (id, quote_id, description, quantity, unit_price, total, type, created_at)
      VALUES
        (gen_random_uuid(), v_quote_id, 'Ampoule phare avant droit – H7 12V 55W', 1, 12.50, 12.50, 'part', NOW() - INTERVAL '8 days'),
        (gen_random_uuid(), v_quote_id, 'Ampoule phare avant gauche – H7 12V 55W', 1, 12.50, 12.50, 'part', NOW() - INTERVAL '8 days'),
        (gen_random_uuid(), v_quote_id, 'Contrôle visuel de sécurité – Inspection complète (inclus)', 1, 0.00, 0.00, 'forfait', NOW() - INTERVAL '8 days'),
        (gen_random_uuid(), v_quote_id, 'Main-d''œuvre – Remplacement ampoules + contrôle', 0.5, 50.00, 25.00, 'labor', NOW() - INTERVAL '8 days')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  
  RAISE NOTICE '✅ Devis créés avec succès';
END $$;

-- Vérification des données créées
SELECT 
  '📊 Résumé des données restaurées' AS info,
  '' AS detail
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
