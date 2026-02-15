/**
 * Script de seed pour restaurer des données d'exemple dans GarageOS
 * 
 * Usage:
 * 1. Assurez-vous d'être connecté à Supabase
 * 2. Exécutez ce script via: npx tsx scripts/seed-database.ts
 * OU
 * 3. Copiez le contenu de supabase/seed-data.sql dans Supabase SQL Editor
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Nécessite la clé service pour bypass RLS

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables d\'environnement manquantes:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\n💡 Utilisez plutôt le fichier SQL: supabase/seed-data.sql');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedDatabase() {
  console.log('🌱 Démarrage du seed de la base de données...\n');

  try {
    // 1. Vérifier/créer un garage
    console.log('1️⃣ Vérification du garage...');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.error('❌ Aucun utilisateur connecté. Connectez-vous d\'abord.');
      return;
    }

    let { data: garages } = await supabase.from('garages').select('id').limit(1);
    let garageId: string;

    if (!garages || garages.length === 0) {
      const { data: newGarage, error: garageError } = await supabase
        .from('garages')
        .insert({
          name: 'Mon Garage',
          address: '123 Rue de la Mécanique, 75000 Paris',
        })
        .select('id')
        .single();

      if (garageError) {
        console.error('❌ Erreur lors de la création du garage:', garageError.message);
        return;
      }

      garageId = newGarage.id;
      console.log(`✅ Garage créé: ${garageId}`);

      // Créer le lien garage_members
      const { error: memberError } = await supabase.from('garage_members').insert({
        garage_id: garageId,
        user_id: user.id,
        role: 'owner',
      });

      if (memberError) {
        console.error('❌ Erreur lors de la création du membre:', memberError.message);
      }
    } else {
      garageId = garages[0].id;
      console.log(`✅ Garage existant trouvé: ${garageId}`);
    }

    // 2. Créer des clients
    console.log('\n2️⃣ Création des clients...');
    const clients = [
      { name: 'Martin Dupont', phone: '06 12 34 56 78', email: 'martin.dupont@email.com', notes: 'Client fidèle depuis 5 ans' },
      { name: 'Sophie Bernard', phone: '06 23 45 67 89', email: 'sophie.bernard@email.com', notes: 'Préfère être contactée par email' },
      { name: 'Pierre Moreau', phone: '06 34 56 78 90', email: 'pierre.moreau@email.com', notes: null },
      { name: 'Marie Dubois', phone: '06 45 67 89 01', email: 'marie.dubois@email.com', notes: 'Véhicule de société' },
      { name: 'Jean Lefebvre', phone: '06 56 78 90 12', email: 'jean.lefebvre@email.com', notes: null },
    ];

    const { data: createdClients, error: clientsError } = await supabase
      .from('clients')
      .insert(clients.map(c => ({ ...c, garage_id: garageId })))
      .select('id, name');

    if (clientsError) {
      console.error('❌ Erreur lors de la création des clients:', clientsError.message);
      return;
    }

    console.log(`✅ ${createdClients.length} clients créés`);

    // 3. Créer des véhicules
    console.log('\n3️⃣ Création des véhicules...');
    const vehicles = [
      { client_name: 'Martin Dupont', registration: 'AB-123-CD', brand: 'Renault', model: 'Clio', year: 2020 },
      { client_name: 'Sophie Bernard', registration: 'EF-456-GH', brand: 'Peugeot', model: '208', year: 2019 },
      { client_name: 'Pierre Moreau', registration: 'IJ-789-KL', brand: 'Citroën', model: 'C3', year: 2021 },
      { client_name: 'Marie Dubois', registration: 'MN-012-OP', brand: 'Volkswagen', model: 'Golf', year: 2018 },
      { client_name: 'Jean Lefebvre', registration: 'QR-345-ST', brand: 'Ford', model: 'Fiesta', year: 2022 },
    ];

    const createdVehicles: Array<{ id: string; client_id: string; registration: string }> = [];

    for (const v of vehicles) {
      const client = createdClients.find(c => c.name === v.client_name);
      if (!client) continue;

      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          garage_id: garageId,
          client_id: client.id,
          registration: v.registration,
          brand: v.brand,
          model: v.model,
          year: v.year,
        })
        .select('id, registration')
        .single();

      if (vehicleError) {
        console.error(`❌ Erreur pour ${v.registration}:`, vehicleError.message);
      } else {
        createdVehicles.push({ id: vehicle.id, client_id: client.id, registration: vehicle.registration });
      }
    }

    console.log(`✅ ${createdVehicles.length} véhicules créés`);

    // 4. Créer des devis avec lignes IA
    console.log('\n4️⃣ Création des devis avec lignes IA...');

    const quotes = [
      {
        client_name: 'Martin Dupont',
        vehicle_reg: 'AB-123-CD',
        reference: 'DEV-2026-001',
        status: 'accepted',
        items: [
          { description: 'Huile moteur 5W30 – 5L (norme constructeur Renault RN0700)', quantity: 1, unit_price: 45.00, type: 'part' },
          { description: 'Plaquettes de frein avant – Kit complet (marque référence)', quantity: 1, unit_price: 120.00, type: 'part' },
          { description: 'Main-d\'œuvre – Remplacement plaquettes avant + vidange moteur', quantity: 0.5, unit_price: 50.00, type: 'labor' },
        ],
      },
      {
        client_name: 'Sophie Bernard',
        vehicle_reg: 'EF-456-GH',
        reference: 'DEV-2026-002',
        status: 'sent',
        items: [
          { description: 'Filtre à huile – Référence constructeur', quantity: 1, unit_price: 15.00, type: 'part' },
          { description: 'Filtre à air – Référence constructeur', quantity: 1, unit_price: 12.00, type: 'part' },
          { description: 'Bougies d\'allumage – Kit 4 pièces', quantity: 1, unit_price: 35.00, type: 'part' },
          { description: 'Main-d\'œuvre – Révision complète (vidange, filtres, bougies)', quantity: 1.5, unit_price: 50.00, type: 'labor' },
        ],
      },
      {
        client_name: 'Pierre Moreau',
        vehicle_reg: 'IJ-789-KL',
        reference: 'DEV-2026-003',
        status: 'draft',
        items: [
          { description: 'Disques de frein avant – Paire (marque référence)', quantity: 1, unit_price: 85.00, type: 'part' },
          { description: 'Main-d\'œuvre – Remplacement disques de frein avant', quantity: 1.0, unit_price: 50.00, type: 'labor' },
        ],
      },
    ];

    let quotesCreated = 0;

    for (const q of quotes) {
      const client = createdClients.find(c => c.name === q.client_name);
      const vehicle = createdVehicles.find(v => v.registration === q.vehicle_reg);
      if (!client || !vehicle) continue;

      const totalHt = q.items.reduce((sum, item) => {
        const total = item.type === 'forfait' ? item.unit_price : item.quantity * item.unit_price;
        return sum + total;
      }, 0);
      const totalTtc = Math.round(totalHt * 1.20 * 100) / 100;

      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          garage_id: garageId,
          client_id: client.id,
          vehicle_id: vehicle.id,
          status: q.status,
          reference: q.reference,
          valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          total_ht: totalHt,
          total_ttc: totalTtc,
        })
        .select('id')
        .single();

      if (quoteError) {
        console.error(`❌ Erreur pour devis ${q.reference}:`, quoteError.message);
        continue;
      }

      // Créer les lignes du devis
      const items = q.items.map(item => ({
        quote_id: quote.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.type === 'forfait' ? item.unit_price : item.quantity * item.unit_price,
        type: item.type,
      }));

      const { error: itemsError } = await supabase.from('quote_items').insert(items);

      if (itemsError) {
        console.error(`❌ Erreur lignes pour ${q.reference}:`, itemsError.message);
      } else {
        quotesCreated++;
        console.log(`  ✅ ${q.reference} créé avec ${items.length} lignes`);
      }
    }

    console.log(`\n✅ ${quotesCreated} devis créés avec lignes IA`);

    // Résumé
    console.log('\n📊 Résumé:');
    console.log(`   - Garage: ${garageId}`);
    console.log(`   - Clients: ${createdClients.length}`);
    console.log(`   - Véhicules: ${createdVehicles.length}`);
    console.log(`   - Devis: ${quotesCreated}`);
    console.log('\n✨ Seed terminé avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
  }
}

seedDatabase();
