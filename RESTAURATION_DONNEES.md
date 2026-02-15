# 🔄 Guide de Restauration des Données GarageOS

Ce guide vous explique comment restaurer vos données (clients, véhicules, devis avec IA) dans GarageOS.

## ⚠️ Problème Actuel

Si vous voyez l'erreur : **"Erreur d'accès. Vérifiez les politiques RLS Supabase et qu'un garage existe (Paramètres)"**, cela signifie que :
1. Aucun garage n'existe dans votre base de données
2. Les politiques RLS (Row Level Security) ne sont pas correctement configurées

## ✅ Solution : Restaurer les Données

### Méthode 1 : Via Supabase SQL Editor (Recommandé)

1. **Ouvrez Supabase Dashboard**
   - Allez sur https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Ouvrez le SQL Editor**
   - Cliquez sur "SQL Editor" dans le menu de gauche
   - Cliquez sur "New query"

3. **Exécutez le script de restauration**
   - Ouvrez le fichier `supabase/RESTAURATION_COMPLETE.sql`
   - Copiez **TOUT** le contenu (politiques RLS + garage + données)
   - Collez-le dans le SQL Editor
   - Cliquez sur "Run" (ou Ctrl+Enter)

4. **Vérifiez les résultats**
   - Le script affichera un résumé des données créées
   - Vous devriez voir :
     - ✅ Garage créé
     - ✅ 5 clients créés
     - ✅ 5 véhicules créés
     - ✅ 4 devis créés avec lignes IA

5. **Rafraîchissez votre application**
   - Retournez dans GarageOS
   - Les données devraient maintenant apparaître !

### Méthode 2 : Via le Terminal (Alternative)

Si vous préférez utiliser le script TypeScript :

```bash
# Installer tsx si nécessaire
npm install -g tsx

# Ajouter SUPABASE_SERVICE_ROLE_KEY dans .env.local si pas déjà présent
# (Vous l'avez déjà dans votre .env.local)

# Exécuter le script
npx tsx scripts/seed-database.ts
```

## 📋 Données Restaurées

Le script restaure :

### Clients (5)
- Martin Dupont (06 12 34 56 78)
- Sophie Bernard (06 23 45 67 89)
- Pierre Moreau (06 34 56 78 90)
- Marie Dubois (06 45 67 89 01)
- Jean Lefebvre (06 56 78 90 12)

### Véhicules (5)
- AB-123-CD - Renault Clio 2020
- EF-456-GH - Peugeot 208 2019
- IJ-789-KL - Citroën C3 2021
- MN-012-OP - Volkswagen Golf 2018
- QR-345-ST - Ford Fiesta 2022

### Devis avec Lignes IA (4)
1. **DEV-2026-001** (Accepté) - Clio - Vidange + Plaquettes
   - Lignes générées par IA avec descriptions professionnelles
   
2. **DEV-2026-002** (Envoyé) - Peugeot 208 - Révision complète
   - Lignes générées par IA avec format "chef d'atelier"
   
3. **DEV-2026-003** (Brouillon) - Citroën C3 - Réparation freinage
   - Lignes générées par IA
   
4. **DEV-2026-004** (Brouillon) - Golf - Contrôle + Réparations
   - Lignes générées par IA avec ligne "inclus" (0€)

## 🔍 Vérification

Après avoir exécuté le script, vérifiez que :

1. ✅ Vous pouvez voir les clients dans `/dashboard/clients`
2. ✅ Vous pouvez voir les véhicules dans `/dashboard/vehicles`
3. ✅ Vous pouvez voir les devis dans `/dashboard/devis`
4. ✅ Les devis contiennent des lignes avec badges "IA"
5. ✅ Vous pouvez créer de nouveaux clients sans erreur

## 🛠️ Si le Problème Persiste

Si vous avez toujours des erreurs après avoir exécuté le script :

1. **Vérifiez les politiques RLS**
   - Allez dans Supabase > Authentication > Policies
   - Assurez-vous que les politiques existent pour :
     - `clients`
     - `vehicles`
     - `quotes`
     - `quote_items`
     - `garages`
     - `garage_members`

2. **Vérifiez que vous êtes connecté**
   - Dans GarageOS, vérifiez que vous êtes bien connecté
   - Le script utilise le premier utilisateur trouvé dans `auth.users`

3. **Contactez le support**
   - Si le problème persiste, vérifiez les logs Supabase
   - Vérifiez que toutes les migrations ont été appliquées

## 📝 Notes

- Le script utilise `ON CONFLICT DO NOTHING` pour éviter les doublons
- Si vous voulez réinitialiser complètement, décommentez les lignes DELETE au début du script
- Les dates sont générées pour simuler des données historiques réalistes
