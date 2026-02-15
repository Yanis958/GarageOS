# GarageOS — Vision Premium / High-Ticket

Document de référence pour transformer GarageOS en outil de pilotage business professionnel, pensé pour un chef de garage.

---

## 🎯 Objectif

Une application **professionnelle**, **rassurante**, **claire**, **rapide**, qui donne envie de payer, adaptée à un vrai garage.

---

## 🎨 1. Design System (priorité absolue)

- **Bleu** = action principale / navigation
- **Orange** = attention / à traiter / relance
- **Vert** = succès / accepté / validé
- **Rouge** = refus / suppression / danger
- Centraliser dans `globals.css` + `tailwind.config.ts`
- Hiérarchie : **primary** / **secondary** / **destructive**
- Typo lisible, pro ; titres H1/H2/H3 ; prix et chiffres très lisibles
- UX : espaces respirants, icônes cohérentes, une action principale par écran

---

## 📊 2. Dashboard = cockpit business

En 10 secondes : combien le garage a gagné, ce qu’il doit faire aujourd’hui, où cliquer.

- KPI cards : CA du mois, devis du mois, en attente, acceptés
- Actions rapides : Nouveau devis, Nouveau client, Nouveau véhicule
- À traiter aujourd’hui : expirés, à relancer, brouillons > X jours
- Activité récente : cliquable, statut visible, date relative

---

## 🧾 3. Devis (cœur du produit)

- Liste : recherche, filtres, badges statuts, menu d’actions
- Détail : lisibilité, actions à droite (sticky), sauvegarde et confirmation
- Lignes : Pièce / Main-d’œuvre / Forfait, totaux en temps réel
- Actions : Enregistrer, Envoyer, PDF, Dupliquer, Marquer accepté/refusé, Supprimer (avec confirmation)

---

## 👤 4. Clients

- Infos claires, historique devis, total facturé, dernière interaction
- Modifier, Archiver, Supprimer (confirmation)

---

## 🚗 5. Véhicules

- Client lié, immat, marque/modèle/année, notes, historique devis
- Formulaire simple, validation claire

---

## 🧠 6. UX Pro / États / Sécurité

- États vides élégants, skeleton loaders, messages clairs
- Archivage par défaut, modales de confirmation, toasts succès/erreur
- Messages humains

---

## ⚠️ Règles

- Ne pas remplacer l’app par une démo
- Ne pas supprimer de features existantes
- Améliorer progressivement
- Vérifier visuellement après chaque modification
