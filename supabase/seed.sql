-- Script de seed pour restaurer des données d'exemple dans GarageOS
-- Ce script crée des clients, véhicules et devis avec lignes IA intégrées

-- 1. Vérifier/créer un garage (nécessaire pour les politiques RLS)
DO $$
DECLARE
  garage_exists BOOLEAN;
  garage_id_val UUID;
BEGIN
  -- Vérifier si un garage existe déjà
  SELECT EXISTS(SELECT 1 FROM garages LIMIT 1) INTO garage_exists;
  
  IF NOT garage_exists THEN
    -- Créer un garage par défaut
    INSERT INTO garages (id, name, address, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Garage Auto Premium',
      '123 Rue de la Mécanique, 75000 Paris',
      NOW(),
      NOW()
    )
    RETURNING id INTO garage_id_val;
  ELSE
    -- Récupérer le premier garage existant
    SELECT id INTO garage_id_val FROM garages LIMIT 1;
  END IF;
  
  -- Créer des clients d'exemple
  INSERT INTO clients (id, garage_id, name, phone, email, notes, created_at, updated_at)
  VALUES
    (
      gen_random_uuid(),
      garage_id_val,
      'Martin Dubois',
      '06 12 34 56 78',
      'martin.dubois@email.com',
      'Client fidèle depuis 5 ans',
      NOW() - INTERVAL '30 days',
      NOW()
    ),
    (
      gen_random_uuid(),
      garage_id_val,
      'Sophie Laurent',
      '07 23 45 67 89',
      'sophie.laurent@email.com',
      'Préfère être contactée par email',
      NOW() - INTERVAL '20 days',
      NOW()
    ),
    (
      gen_random_uuid(),
      garage_id_val,
      'Pierre Moreau',
      '06 98 76 54 32',
      'pierre.moreau@email.com',
      NULL,
      NOW() - INTERVAL '15 days',
      NOW()
    ),
    (
      gen_random_uuid(),
      garage_id_val,
      'Julie Bernard',
      '07 11 22 33 44',
      'julie.bernard@email.com',
      'Véhicule sous garantie constructeur',
      NOW() - INTERVAL '10 days',
      NOW()
    ),
    (
      gen_random_uuid(),
      garage_id_val,
      'Thomas Petit',
      '06 55 66 77 88',
      'thomas.petit@email.com',
      NULL,
      NOW() - INTERVAL '5 days',
      NOW()
    )
  ON CONFLICT DO NOTHING;

  -- Créer des véhicules liés aux clients
  WITH client_data AS (
    SELECT id, name FROM clients WHERE garage_id = garage_id_val ORDER BY created_at LIMIT 5
  )
  INSERT INTO vehicles (id, garage_id, client_id, registration, brand, model, year, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    garage_id_val,
    c.id,
    CASE row_number() OVER (ORDER BY c.created_at)
      WHEN 1 THEN 'AB-123-CD'
      WHEN 2 THEN 'EF-456-GH'
      WHEN 3 THEN 'IJ-789-KL'
      WHEN 4 THEN 'MN-012-OP'
      WHEN 5 THEN 'QR-345-ST'
    END,
    CASE row_number() OVER (ORDER BY c.created_at)
      WHEN 1 THEN 'Renault'
      WHEN 2 THEN 'Peugeot'
      WHEN 3 THEN 'Citroën'
      WHEN 4 THEN 'Volkswagen'
      WHEN 5 THEN 'Ford'
    END,
    CASE row_number() OVER (ORDER BY c.created_at)
      WHEN 1 THEN 'Clio'
      WHEN 2 THEN '308'
      WHEN 3 THEN 'C3'
      WHEN 4 THEN 'Golf'
      WHEN 5 THEN 'Focus'
    END,
    CASE row_number() OVER (ORDER BY c.created_at)
      WHEN 1 THEN 2020
      WHEN 2 THEN 2019
      WHEN 3 THEN 2021
      WHEN 4 THEN 2018
      WHEN 5 THEN 2022
    END,
    NOW() - INTERVAL '25 days',
    NOW()
  FROM client_data c
  ON CONFLICT DO NOTHING;

  -- Créer des devis avec lignes générées par IA
  WITH vehicle_data AS (
    SELECT v.id as vehicle_id, v.client_id, c.name as client_name
    FROM vehicles v
    JOIN clients c ON v.client_id = c.id
    WHERE v.garage_id = garage_id_val
    ORDER BY v.created_at
    LIMIT 5
  )
  INSERT INTO quotes (id, garage_id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, notes_client, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    garage_id_val,
    vd.client_id,
    vd.vehicle_id,
    CASE row_number() OVER (ORDER BY vd.vehicle_id)
      WHEN 1 THEN 'accepted'
      WHEN 2 THEN 'sent'
      WHEN 3 THEN 'draft'
      WHEN 4 THEN 'accepted'
      WHEN 5 THEN 'sent'
    END,
    CASE row_number() OVER (ORDER BY vd.vehicle_id)
      WHEN 1 THEN 'DEV-2026-001'
      WHEN 2 THEN 'DEV-2026-002'
      WHEN 3 THEN 'DEV-2026-003'
      WHEN 4 THEN 'DEV-2026-004'
      WHEN 5 THEN 'DEV-2026-005'
    END,
    (NOW() + INTERVAL '30 days')::date,
    CASE row_number() OVER (ORDER BY vd.vehicle_id)
      WHEN 1 THEN 450.00
      WHEN 2 THEN 320.50
      WHEN 3 THEN 280.00
      WHEN 4 THEN 520.75
      WHEN 5 THEN 380.25
    END,
    CASE row_number() OVER (ORDER BY vd.vehicle_id)
      WHEN 1 THEN 540.00
      WHEN 2 THEN 384.60
      WHEN 3 THEN 336.00
      WHEN 4 THEN 624.90
      WHEN 5 THEN 456.30
    END,
    CASE row_number() OVER (ORDER BY vd.vehicle_id)
      WHEN 1 THEN 'Merci de votre confiance.'
      WHEN 2 THEN NULL
      WHEN 3 THEN 'Devis à valider rapidement.'
      WHEN 4 THEN NULL
      WHEN 5 THEN 'Valable 30 jours.'
    END,
    NOW() - INTERVAL '20 days',
    NOW()
  FROM vehicle_data vd
  ON CONFLICT DO NOTHING;

  -- Créer les lignes de devis avec format IA propre
  WITH quote_data AS (
    SELECT q.id as quote_id, q.reference, row_number() OVER (ORDER BY q.created_at) as rn
    FROM quotes q
    WHERE q.garage_id = garage_id_val
    ORDER BY q.created_at
    LIMIT 5
  )
  INSERT INTO quote_items (
    id, quote_id, description, quantity, unit_price, total, type,
    optional, optional_reason, cost_price_ht, margin_ht, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    -- Ligne 1 : Pièce (plaquettes avant)
    'Plaquettes de frein avant – Kit complet (norme constructeur)',
    1,
    85.00,
    85.00,
    'part',
    false,
    NULL,
    50.00,
    35.00,
    NOW() - INTERVAL '20 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 1
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    -- Ligne 2 : Main-d'œuvre (montage plaquettes)
    'Main-d''œuvre – Remplacement plaquettes avant (démontage, nettoyage, montage, purge)',
    1.5,
    65.00,
    97.50,
    'labor',
    false,
    NULL,
    0,
    97.50,
    NOW() - INTERVAL '20 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 1
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    -- Ligne 3 : Pièce (vidange)
    'Huile moteur 5W30 – 5L (norme constructeur Renault RN0700)',
    1,
    45.00,
    45.00,
    'part',
    false,
    NULL,
    25.00,
    20.00,
    NOW() - INTERVAL '20 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 1
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    -- Ligne 4 : Pièce (filtre)
    'Filtre à huile (référence constructeur)',
    1,
    12.50,
    12.50,
    'part',
    false,
    NULL,
    7.00,
    5.50,
    NOW() - INTERVAL '20 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 1
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    -- Ligne 5 : Main-d'œuvre (vidange)
    'Main-d''œuvre – Vidange complète (huile + filtre)',
    0.5,
    65.00,
    32.50,
    'labor',
    false,
    NULL,
    0,
    32.50,
    NOW() - INTERVAL '20 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 1
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    -- Ligne 6 : Option (contrôle visuel)
    'Contrôle visuel de sécurité (pneus, éclairage, niveaux)',
    1,
    0,
    0,
    'part',
    true,
    'Recommandé mais non obligatoire',
    0,
    0,
    NOW() - INTERVAL '20 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 1
  UNION ALL
  -- Devis 2 : Révision complète
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Révision complète – Kit filtre (air, habitacle, huile)',
    1,
    75.00,
    75.00,
    'part',
    false,
    NULL,
    45.00,
    30.00,
    NOW() - INTERVAL '18 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 2
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Huile moteur 5W30 – 5L',
    1,
    42.50,
    42.50,
    'part',
    false,
    NULL,
    24.00,
    18.50,
    NOW() - INTERVAL '18 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 2
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Main-d''œuvre – Révision complète (vidange, filtres, contrôles)',
    2,
    65.00,
    130.00,
    'labor',
    false,
    NULL,
    0,
    130.00,
    NOW() - INTERVAL '18 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 2
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Contrôle technique avant échéance',
    1,
    0,
    0,
    'part',
    true,
    'Inclus dans la prestation',
    0,
    0,
    NOW() - INTERVAL '18 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 2
  UNION ALL
  -- Devis 3 : Réparation freinage
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Disques de frein avant – Paire (norme constructeur)',
    1,
    120.00,
    120.00,
    'part',
    false,
    NULL,
    70.00,
    50.00,
    NOW() - INTERVAL '15 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 3
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Plaquettes de frein avant – Kit',
    1,
    65.00,
    65.00,
    'part',
    false,
    NULL,
    38.00,
    27.00,
    NOW() - INTERVAL '15 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 3
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Main-d''œuvre – Remplacement disques et plaquettes avant',
    2.5,
    65.00,
    162.50,
    'labor',
    false,
    NULL,
    0,
    162.50,
    NOW() - INTERVAL '15 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 3
  UNION ALL
  -- Devis 4 : Entretien périodique
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Révision 20 000 km – Kit complet (huile, filtres, bougies)',
    1,
    180.00,
    180.00,
    'forfait',
    false,
    NULL,
    110.00,
    70.00,
    NOW() - INTERVAL '12 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 4
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Main-d''œuvre – Révision complète',
    2,
    65.00,
    130.00,
    'labor',
    false,
    NULL,
    0,
    130.00,
    NOW() - INTERVAL '12 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 4
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Nettoyage injecteurs (optionnel)',
    1,
    0,
    0,
    'part',
    true,
    'Recommandé pour optimiser la consommation',
    0,
    0,
    NOW() - INTERVAL '12 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 4
  UNION ALL
  -- Devis 5 : Réparation climatisation
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Recharge climatisation – Gaz R134a (norme)',
    1,
    95.00,
    95.00,
    'part',
    false,
    NULL,
    55.00,
    40.00,
    NOW() - INTERVAL '8 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 5
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Main-d''œuvre – Recharge et contrôle climatisation',
    1,
    65.00,
    65.00,
    'labor',
    false,
    NULL,
    0,
    65.00,
    NOW() - INTERVAL '8 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 5
  UNION ALL
  SELECT
    gen_random_uuid(),
    qd.quote_id,
    'Nettoyage système de climatisation',
    1,
    0,
    0,
    'part',
    true,
    'Inclus dans la prestation',
    0,
    0,
    NOW() - INTERVAL '8 days',
    NOW()
  FROM quote_data qd WHERE qd.rn = 5;

  RAISE NOTICE 'Seed terminé avec succès !';
END $$;
