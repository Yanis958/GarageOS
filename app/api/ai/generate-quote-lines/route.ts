import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Mistral } from "@mistralai/mistralai";
import { z } from "zod";
import { promises as fs } from "fs";
import { join } from "path";
import { getCurrentGarageId } from "@/lib/actions/garage";
import { createClient } from "@/lib/supabase/server";
import { recordAiUsage, isFeatureEnabledForGarage } from "@/lib/actions/admin";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { checkAiQuota } from "@/lib/ai/quota";
import { logAiEvent } from "@/lib/ai/ai-events";
import { safeAiCall } from "@/lib/ai/safe-ai";
import { postProcessQuoteItems } from "@/lib/ai/post-process-quote-items";
import { getPriceMemory, isPriceMemoryEnabled, normalizeKey } from "@/lib/price-memory";

/**
 * Route API pour générer des lignes de devis via IA.
 * Ordre de priorité :
 * 1. Mistral AI (solution principale, natif français, JSON natif)
 * 2. Gemini (fallback)
 * 3. OpenAI (fallback)
 * 
 * Configuration :
 * - MISTRAL_API_KEY=... (recommandé, obtenu sur https://console.mistral.ai)
 * - GEMINI_API_KEY=AIza... (optionnel, pour Gemini fallback)
 * - OPENAI_API_KEY=sk-... (optionnel, pour OpenAI fallback)
 */

const LineSchema = z.object({
  type: z.enum(["piece", "main_oeuvre", "forfait"]),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(["unite", "heure"]),
  unit_price_ht: z.number().nonnegative(),
  isOption: z.boolean().default(false),
  isIncluded: z.boolean().default(false),
}).refine(
  (data) => {
    // Si isIncluded === true, alors unit_price_ht doit être 0
    if (data.isIncluded && data.unit_price_ht !== 0) {
      return false;
    }
    // unit doit correspondre au type
    if (data.type === "main_oeuvre" && data.unit !== "heure") {
      return false;
    }
    if (data.type === "piece" && data.unit !== "unite") {
      return false;
    }
    if (data.type === "forfait" && data.unit !== "unite") {
      return false;
    }
    return true;
  },
  {
    message: "isIncluded=true nécessite unit_price_ht=0, et unit doit correspondre au type",
  }
);

const ResponseSchema = z.object({
  lines: z.array(LineSchema).min(1),
});

const systemPrompt = `Tu es un chef d'atelier automobile expérimenté travaillant dans un garage professionnel.
Ta mission est de générer un devis automobile PREMIUM, ultra lisible, logique métier garage, à partir d'une description libre de l'intervention.

OBJECTIF MÉTIER :
Un devis doit ressembler à ce qu'un VRAI garage facture : simple, clair, professionnel, logique, exploitable immédiatement.

RÈGLES STRICTES (À RESPECTER ABSOLUMENT) :

1. STRUCTURE DU DEVIS
Génère UNIQUEMENT une liste de lignes de devis structurées, sans texte explicatif.
Chaque ligne doit respecter ce schéma JSON strict :

{
  "type": "piece" | "main_oeuvre" | "forfait",
  "description": "string",
  "quantity": number,
  "unit": "unite" | "heure",
  "unit_price_ht": number,
  "isOption": boolean,
  "isIncluded": boolean
}

2. STRUCTURE IDÉALE D'UN DEVIS (CRITIQUE)

SECTION PIÈCES :
- 1 ligne par pièce réelle
- Pas de doublon (ex: huile moteur en 2 lignes)
- Nom clair et professionnel
- Pas de texte coupé
- Exemples corrects :
  ✅ "Plaquettes de frein avant"
  ✅ "Huile moteur 5W30 — 4L"
  ✅ "Filtre à huile"

SECTION MAIN-D'ŒUVRE :
- Regroupée par intervention logique
- Pas une ligne par micro-action
- Exemples corrects :
  ✅ "Remplacement plaquettes avant"
  ✅ "Vidange moteur + remplacement filtre"
  ✅ "Intervention freinage complète"
- Durées réalistes (ex : 1.25h, 0.75h)
- Pas de 0h
- Pas de lignes inutiles

SECTION FORFAIT :
- Uniquement si réellement pertinent
- Ex: "Consommables atelier"
- Pas automatique

SECTION OPTIONS :
- Jamais activées par défaut
- Clairement identifiées (isOption=true)
- Description propre
- Jamais ambiguës

3. REGROUPEMENT DES ÉLÉMENTS INCLUS (0€)
- Les éléments gratuits (contrôles, vérifications, essais) doivent être INTÉGRÉS dans la description de la ligne principale.
- Si plusieurs éléments inclus, créer UNE SEULE ligne "Contrôles & sécurité (Inclus)" avec isIncluded=true, unit_price_ht=0.
- Ne JAMAIS créer 5+ lignes à 0€ séparées. Toujours regrouper.

4. TYPES AUTORISÉS
- piece : pièces détachées, consommables, fluides
- main_oeuvre : temps de travail en heures (regrouper les micro-tâches)
- forfait : prestations fixes (ex: consommables atelier)

5. PRIX & DURÉES
- Utilise des prix réalistes du marché français.
- Taux horaire de main-d'œuvre : 60 € HT / heure (FIXE, non négociable).
- Durées cohérentes avec l'intervention demandée.
- Ne JAMAIS inventer des prix irréalistes ou excessifs.
- TOUJOURS respecter le temps total estimé mentionné par l'utilisateur (ex: "environ 2h" → utiliser 2.0).
- Quand tu regroupes plusieurs micro-tâches, additionne les durées et calcule le prix total correctement.

13. COHÉRENCE MÉCANIQUE OBLIGATOIRE (CRITIQUE)
- INTERDICTION ABSOLUE de mélanger des viscosités différentes (ex: 5W30 et 5W40 dans le même devis).
- Si une huile est mentionnée, utiliser UNE SEULE viscosité cohérente pour tout le devis.
- INTERDICTION de générer des pièces incompatibles entre elles (ex: plaquettes avant + disques arrière sans cohérence).
- Les descriptions doivent être techniquement cohérentes.
- Si info véhicule absente → rester générique mais cohérent (ne pas inventer de spécificités).
- Exemples d'incohérences à éviter :
  ❌ "Huile moteur 5W30 — 5L" + "Huile moteur 5W40 — 5L"
  ❌ "Plaquettes avant" + "Disques arrière" sans cohérence logique
  ✅ "Huile moteur 5W30 — 5L" (une seule viscosité)
  ✅ "Plaquettes avant" + "Disques avant" (cohérent)

6. REGROUPEMENT LOGIQUE (CRITIQUE - OBLIGATOIRE)
- Vidange + filtre DOIT être une seule ligne MO. INTERDICTION de créer 2 lignes séparées.
- Regroupe automatiquement les interventions liées.
- Exemple : Huile moteur + filtre → regroupé dans une seule logique d'intervention.
- Pas 2 lignes de main-d'œuvre séparées si c'est la même opération.
- Si intervention combinée → temps combiné logique.
- Ne jamais doubler les heures inutilement.
- Exemples avant/après clairs :
  ❌ "Vidange moteur" (0.5h) + "Remplacement filtre" (0.25h) séparées (INTERDIT)
  ✅ "Vidange moteur + remplacement filtre" (1 ligne, 0.75h) (OBLIGATOIRE)
  ❌ "Remplacement plaquettes" (0.5h) + "Contrôle disques" (0.25h) séparées (INTERDIT)
  ✅ "Remplacement plaquettes avant" (1 ligne, 1.25h) (OBLIGATOIRE)

7. NOMS PROPRES (CRITIQUE - NETTOYAGE STRICT)
- Corriger automatiquement :
  - Texte tronqué
  - Majuscules aléatoires
  - "Option recommandée — N..."
  - Abréviations incomplètes
- Descriptions TOUJOURS complètes, jamais tronquées, jamais de "...".
- INTERDICTION ABSOLUE des descriptions finissant par :
  ❌ "(" (parenthèse ouverte)
  ❌ "—" (em dash seul)
  ❌ "+" (plus seul)
  ❌ "-" (tiret seul)
  ❌ "/" (slash seul)
  ❌ texte coupé en plein mot
  ❌ mot incomplet (ex: "Remplac", "Plaquett", "Consommabl")
  ❌ lettre isolée (ex: "I", "A", "O" en fin)
- Si une description contient "+", la partie après "+" DOIT être complète (ex: "Vidange moteur + remplacement filtre", PAS "Vidange moteur + Remplac").
- Si une description contient "(", elle DOIT contenir ")" avec du texte complet (ex: "Consommables atelier (produits nettoyants, chiffons, petits matériaux)", PAS "Consommables atelier (pro").
- TOUTES les descriptions doivent être grammaticalement complètes et terminées, sans mots coupés ni lettres isolées.
- INTERDICTION EXPLICITE des parenthèses avec "contrôle", "inclus", "essai".
- INTERDICTION des descriptions > 50 caractères pour les libellés principaux.
- Pas de texte marketing, pas de blabla, pas de phrases longues.
- Pas d'explication commerciale dans les lignes.
- Juste des libellés propres et courts.
- Utiliser un vocabulaire métier simple et professionnel.
- Pas d'abréviations techniques incompréhensibles.
- Quantités réalistes et précises (ex: "4L", "Jeu complet (4 plaquettes)").
- Terminologie garage standard française.
- INTERDICTION ABSOLUE des libellés vagues :
  ❌ "Freinage — Remplacement"
  ❌ "Option recommandée — N..." (description tronquée)
  ❌ "Service moteur"
  ❌ "Intervention diverse"
  ❌ "Remplacement" (trop vague)
  ❌ "Remplacement plaquettes avant (contrôles et essai inclus)" (parenthèses interdites)
  ❌ "Remplacement plaquettes (" (description tronquée)
  ❌ "Vidange moteur + remplac" (mot coupé)
- Chaque ligne DOIT être explicite et propre :
  ✅ "Remplacement plaquettes de frein avant"
  ✅ "Vidange moteur + remplacement filtre"
  ✅ "Huile moteur 5W30 — 4L"
  ✅ "Filtre à huile"
- FORMATAGE UNIFORME :
  - Utilise "—" (em dash) pour séparer les éléments principaux.
  - Utilise "+" pour actions combinées ("Vidange moteur + remplacement filtre").
  - Format uniforme et professionnel : première lettre majuscule pour chaque mot important.
  - Exemples :
    ✅ "Huile moteur 5W30 — 4L"
    ✅ "Plaquettes de frein avant"
    ✅ "Vidange moteur + remplacement filtre"
    ❌ "huile moteur 5w30-4l"
    ❌ "plaquettes-avant"

8. ORDRE DES LIGNES (CRITIQUE - STRICT)
Respecter strictement cet ordre :
1) Pièces principales (regroupées si nécessaire)
2) Main-d'œuvre principale (regroupée, micro-tâches incluses)
3) Forfaits / consommables
4) Options recommandées (séparées, avec préfixe "Option recommandée — ")
- INTERDICTION des lignes à 0h pour main-d'œuvre.
- Forcer des durées réalistes : minimum 0.25h, arrondi à 0.05h.
- Exemples de durées réalistes :
  ✅ 0.25h, 0.5h, 0.75h, 1h, 1.25h, 1.5h, 2h
  ❌ 0h (INTERDIT)
  ❌ 0.13h (trop précis, arrondir à 0.15h)

9. SUPPRESSION DES DOUBLONS (CRITIQUE - INTERDICTION ABSOLUE)
- INTERDICTION EXPLICITE de créer "Huile moteur 5W30 — 4L" en double.
- Si deux lignes représentent la même chose → fusionner automatiquement DÈS LA GÉNÉRATION.
- Ne JAMAIS créer de doublons. Si tu génères "Huile moteur 5W30 — 4L" deux fois, fusionne en une seule ligne avec quantité additionnée.
- Si deux lignes sont quasi identiques (même produit/service, même type, même prix unitaire), fusionne-les automatiquement.
- Additionne les quantités lors de la fusion.
- Garde la description la plus complète lors de la fusion.
- Exemples d'erreurs à éviter :
  ❌ "Huile moteur 5W30 — 4L" + "Huile moteur 5W30 — 4L" (doublon interdit)
  ❌ "Plaquettes de frein avant" + "Plaquettes avant" (même pièce, fusionner)
  ✅ "Huile moteur 5W30 — 4L" (quantity: 2) (une seule ligne)
  ✅ "Plaquettes de frein avant" (une seule ligne)

10. OPTIONS INTELLIGENTES ET EXPLICITES (CRITIQUE)
- Une option DOIT être claire et justifiée.
- INTERDICTION des options vagues :
  ❌ "Option recommandée — N…" (description tronquée)
  ❌ "Option atelier"
  ❌ "Option sécurité" (trop vague)
- Exemples autorisés :
  ✅ "Nettoyant circuit de frein (option recommandée)"
  ✅ "Additif moteur préventif"
  ✅ "Protection sous-carrossage (option recommandée)"
- Toujours inclure une description complète de ce qu'est l'option.
- Préfixer avec "Option recommandée — " uniquement si la description complète suit.
- Les options doivent être clairement identifiées (isOption=true).
- Ne pas forcer des options inutiles.
- Les options restent TOUJOURS séparées, jamais mélangées avec les lignes incluses.

14. COHÉRENCE PIÈCE / MAIN-D'ŒUVRE (CRITIQUE)
- Si une pièce est générée, la main-d'œuvre associée DOIT reprendre le même wording.
- Exemple correct :
  PIÈCE : "Plaquettes de frein avant"
  MAIN-D'ŒUVRE : "Remplacement plaquettes de frein avant"
- Même vocabulaire. Même logique. Cohérence parfaite.
- Ne pas utiliser "Freinage — Remplacement" si la pièce s'appelle "Plaquettes de frein avant".
- Utiliser le même terme technique dans les deux lignes.

11. UNITÉS
- "unite" : pour les pièces (piece) et forfaits (forfait)
- "heure" : pour la main-d'œuvre (main_oeuvre)

12. SORTIE ATTENDUE
- Retourne UNIQUEMENT un tableau JSON valide avec la clé "lines".
- Aucun texte avant ou après.
- Aucun commentaire.
- JSON strictement valide.
- MAXIMUM 8-12 lignes au total (pas 20+ micro-lignes).

EXEMPLE D'ENTRÉE UTILISATEUR :
"Clio 4, plaquettes avant + vidange"

EXEMPLE DE SORTIE ATTENDUE (format garage réel) :
{
  "lines": [
    {
      "type": "piece",
      "description": "Plaquettes de frein avant",
      "quantity": 1,
      "unit": "unite",
      "unit_price_ht": 50,
      "isOption": false,
      "isIncluded": false
    },
    {
      "type": "piece",
      "description": "Huile moteur 5W30 — 4L",
      "quantity": 1,
      "unit": "unite",
      "unit_price_ht": 25,
      "isOption": false,
      "isIncluded": false
    },
    {
      "type": "piece",
      "description": "Filtre à huile",
      "quantity": 1,
      "unit": "unite",
      "unit_price_ht": 8,
      "isOption": false,
      "isIncluded": false
    },
    {
      "type": "main_oeuvre",
      "description": "Remplacement plaquettes avant",
      "quantity": 1.25,
      "unit": "heure",
      "unit_price_ht": 60,
      "isOption": false,
      "isIncluded": false
    },
    {
      "type": "main_oeuvre",
      "description": "Vidange moteur + remplacement filtre",
      "quantity": 0.75,
      "unit": "heure",
      "unit_price_ht": 60,
      "isOption": false,
      "isIncluded": false
    },
    {
      "type": "forfait",
      "description": "Consommables atelier",
      "quantity": 1,
      "unit": "unite",
      "unit_price_ht": 15,
      "isOption": false,
      "isIncluded": false
    }
  ]
}

OBJECTIF FINAL :
Produire un devis simple, clair, professionnel, logique, exploitable immédiatement par un garage réel. Sans doublon, sans ligne coupée, sans incohérence, sans lignes inutiles.`;

async function tryMistral(description: string): Promise<{ lines: any[] } | { error: string } | null> {
  const apiKey = process.env.MISTRAL_API_KEY?.trim();
  
  if (!apiKey) {
    console.log("[Mistral] Clé API non trouvée dans process.env.MISTRAL_API_KEY");
    return null;
  }

  console.log(`[Mistral] Tentative avec SDK Mistral AI`);

  try {
    const mistral = new Mistral({ apiKey });
    
    // Essayer mistral-large-latest d'abord (meilleur pour français), puis mistral-medium-latest (gratuit)
    const models = ["mistral-large-latest", "mistral-medium-latest"];
    
    for (const model of models) {
      try {
        console.log(`[Mistral] Essai avec modèle ${model}`);
        
        const response = await mistral.chat.complete({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Description d'intervention : "${description.trim()}"` },
          ],
          responseFormat: { type: "json_object" },
          temperature: 0.3,
        });

        const raw = response.choices[0]?.message?.content;
        if (!raw) {
          console.error(`[Mistral] Aucun contenu dans la réponse (modèle ${model})`);
          if (model !== models[models.length - 1]) continue;
          return { error: "Mistral n'a retourné aucun contenu" };
        }
        const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((c) => (typeof c === "string" ? c : (c as { text?: string }).text ?? "")).join("") : "";

        // Parser le JSON
        let parsed;
        try {
          parsed = JSON.parse(content);
        } catch (parseError: any) {
          console.error(`[Mistral] Erreur parsing JSON (modèle ${model}):`, parseError.message);
          if (model !== models[models.length - 1]) continue;
          return { error: `Erreur parsing JSON: ${parseError.message}` };
        }

        const validated = ResponseSchema.safeParse(parsed);
        if (validated.success && validated.data.lines.length > 0) {
          console.log(`[Mistral] Succès avec modèle ${model} ! ${validated.data.lines.length} lignes générées`);
          return { 
            lines: validated.data.lines,
          };
        } else {
          console.error(`[Mistral] Validation échouée (modèle ${model}):`, validated.error);
          if (model !== models[models.length - 1]) continue;
          return { error: `Format de réponse invalide: ${validated.error?.message ?? "Validation échouée"}` };
        }
      } catch (modelError: any) {
        console.error(`[Mistral] Erreur avec modèle ${model}:`, modelError.message);
        // Si erreur 404 (modèle non trouvé), essayer le suivant
        if (modelError.status === 404 || modelError.message?.includes("404") || modelError.message?.includes("not found")) {
          if (model !== models[models.length - 1]) continue;
        }
        // Si erreur de quota/rate limit, essayer le suivant
        if (modelError.status === 429 || modelError.message?.includes("429") || modelError.message?.includes("quota")) {
          if (model !== models[models.length - 1]) continue;
        }
        // Sinon, retourner l'erreur
        if (model === models[models.length - 1]) {
          return { error: `Erreur Mistral: ${modelError.message || "Erreur inconnue"}` };
        }
      }
    }

    return { error: "Tous les modèles Mistral ont échoué" };
  } catch (e: any) {
    console.error("[Mistral] Exception:", e.message || e);
    return { error: `Erreur Mistral: ${e.message || "Erreur inconnue"}` };
  }
}

async function tryGemini(description: string): Promise<{ lines: any[] } | { error: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  
  // #region agent log
  try {
    const logPath = join(process.cwd(), '.cursor', 'debug.log');
    const logEntry = JSON.stringify({
      location: 'route.ts:54',
      message: 'tryGemini entry',
      data: { hasApiKey: !!apiKey, apiKeyPrefix: apiKey?.substring(0, 10) },
      timestamp: Date.now(),
      runId: 'run3',
      hypothesisId: 'C'
    }) + '\n';
    await fs.appendFile(logPath, logEntry).catch(() => {});
  } catch {}
  // #endregion
  
  if (!apiKey) {
    // #region agent log
    try {
      const logPath = join(process.cwd(), '.cursor', 'debug.log');
      const logEntry = JSON.stringify({
        location: 'route.ts:61',
        message: 'API key not found',
        data: {},
        timestamp: Date.now(),
        runId: 'run3',
        hypothesisId: 'C'
      }) + '\n';
      await fs.appendFile(logPath, logEntry).catch(() => {});
    } catch {}
    // #endregion
    console.log("[Gemini] Clé API non trouvée dans process.env.GEMINI_API_KEY");
    return null;
  }
  
  if (!apiKey.startsWith("AIza")) {
    // #region agent log
    try {
      const logPath = join(process.cwd(), '.cursor', 'debug.log');
      const logEntry = JSON.stringify({
        location: 'route.ts:69',
        message: 'API key invalid format',
        data: { prefix: apiKey.substring(0, 10) },
        timestamp: Date.now(),
        runId: 'run3',
        hypothesisId: 'C'
      }) + '\n';
      await fs.appendFile(logPath, logEntry).catch(() => {});
    } catch {}
    // #endregion
    console.log(`[Gemini] Clé API invalide (ne commence pas par "AIza"): ${apiKey.substring(0, 10)}...`);
    return null;
  }

  console.log(`[Gemini] Tentative avec SDK Google Generative AI`);

  // Essayer plusieurs modèles Gemini avec le SDK (dans l'ordre de préférence)
  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro",
  ];

  for (const model of models) {
    try {
      // #region agent log
      try {
        const logPath = join(process.cwd(), '.cursor', 'debug.log');
        const logEntry = JSON.stringify({
          location: 'route.ts:87',
          message: 'Trying Gemini model with SDK',
          data: { model },
          timestamp: Date.now(),
          runId: 'run4',
          hypothesisId: 'D'
        }) + '\n';
        await fs.appendFile(logPath, logEntry).catch(() => {});
      } catch {}
      // #endregion
      
      const genAI = new GoogleGenerativeAI(apiKey);
      const genModel = genAI.getGenerativeModel({ model });
      
      const prompt = `${systemPrompt}\n\nDescription d'intervention : "${description.trim()}"\n\nRetourne maintenant le JSON (objet avec clé "lines") :`;
      
      // #region agent log
      try {
        const logPath = join(process.cwd(), '.cursor', 'debug.log');
        const logEntry = JSON.stringify({
          location: 'route.ts:95',
          message: 'Calling Gemini SDK generateContent',
          data: { model, promptLength: prompt.length },
          timestamp: Date.now(),
          runId: 'run4',
          hypothesisId: 'D'
        }) + '\n';
        await fs.appendFile(logPath, logEntry).catch(() => {});
      } catch {}
      // #endregion
      
      const result = await genModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3 },
      });

      // #region agent log
      try {
        const logPath = join(process.cwd(), '.cursor', 'debug.log');
        const logEntry = JSON.stringify({
          location: 'route.ts:102',
          message: 'Gemini SDK response received',
          data: { model, hasResponse: !!result.response },
          timestamp: Date.now(),
          runId: 'run4',
          hypothesisId: 'D'
        }) + '\n';
        await fs.appendFile(logPath, logEntry).catch(() => {});
      } catch {}
      // #endregion

      const response = result.response;
      const content = response.text();
      
      if (!content) {
        console.error(`[Gemini] Aucun contenu dans la réponse (modèle ${model})`);
        if (model !== models[models.length - 1]) {
          continue;
        }
        return { error: "Gemini n'a retourné aucun contenu" };
      }

      // #region agent log
      try {
        const logPath = join(process.cwd(), '.cursor', 'debug.log');
        const logEntry = JSON.stringify({
          location: 'route.ts:115',
          message: 'Gemini content extracted',
          data: { model, contentLength: content.length, contentPreview: content.substring(0, 200) },
          timestamp: Date.now(),
          runId: 'run4',
          hypothesisId: 'D'
        }) + '\n';
        await fs.appendFile(logPath, logEntry).catch(() => {});
      } catch {}
      // #endregion

      // Nettoyer le contenu : retirer markdown, extraire le JSON
      let cleaned = content.trim();
      // Retirer les blocs markdown ```json ... ```
      cleaned = cleaned.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      // Chercher le premier { et le dernier } pour extraire le JSON
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.substring(firstBrace, lastBrace + 1);
      }
      
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseError: any) {
        // #region agent log
        try {
          const logPath = join(process.cwd(), '.cursor', 'debug.log');
          const logEntry = JSON.stringify({
            location: 'route.ts:130',
            message: 'JSON parse error',
            data: { model, error: parseError.message, cleanedPreview: cleaned.substring(0, 200) },
            timestamp: Date.now(),
            runId: 'run4',
            hypothesisId: 'D'
          }) + '\n';
          await fs.appendFile(logPath, logEntry).catch(() => {});
        } catch {}
        // #endregion
        console.error(`[Gemini] Erreur parsing JSON (modèle ${model}):`, parseError.message);
        if (model !== models[models.length - 1]) {
          continue;
        }
        return { error: `Erreur parsing JSON: ${parseError.message}` };
      }
      
      const validated = ResponseSchema.safeParse(parsed);
      if (validated.success && validated.data.lines.length > 0) {
        // #region agent log
        try {
          const logPath = join(process.cwd(), '.cursor', 'debug.log');
          const logEntry = JSON.stringify({
            location: 'route.ts:145',
            message: 'Gemini success',
            data: { linesCount: validated.data.lines.length, model },
            timestamp: Date.now(),
            runId: 'run4',
            hypothesisId: 'D'
        }) + '\n';
          await fs.appendFile(logPath, logEntry).catch(() => {});
        } catch {}
        // #endregion
        console.log(`[Gemini] Succès avec modèle ${model} ! ${validated.data.lines.length} lignes générées`);
        return { 
          lines: validated.data.lines,
        };
      } else {
        // #region agent log
        try {
          const logPath = join(process.cwd(), '.cursor', 'debug.log');
          const logEntry = JSON.stringify({
            location: 'route.ts:152',
            message: 'Gemini validation failed',
            data: { error: validated.error?.message, model },
            timestamp: Date.now(),
            runId: 'run4',
            hypothesisId: 'D'
          }) + '\n';
          await fs.appendFile(logPath, logEntry).catch(() => {});
        } catch {}
        // #endregion
        console.error(`[Gemini] Validation échouée (modèle ${model}):`, validated.error);
        if (model !== models[models.length - 1]) {
          continue;
        }
        return { error: `Format de réponse invalide: ${validated.error?.message ?? "Validation échouée"}` };
      }
    } catch (e: any) {
      // #region agent log
      try {
        const logPath = join(process.cwd(), '.cursor', 'debug.log');
        const logEntry = JSON.stringify({
          location: 'route.ts:160',
          message: 'Gemini exception',
          data: { error: e.message, model, errorName: e.name, errorStack: e.stack?.substring(0, 200) },
          timestamp: Date.now(),
          runId: 'run4',
          hypothesisId: 'D'
        }) + '\n';
        await fs.appendFile(logPath, logEntry).catch(() => {});
      } catch {}
      // #endregion
      console.error(`[Gemini] Exception avec modèle ${model}:`, e.message || e);
      if (model !== models[models.length - 1]) {
        continue;
      }
      return { error: `Erreur Gemini: ${e.message || "Erreur inconnue"}` };
    }
  }

  return { error: "Tous les modèles Gemini ont échoué" };
}

async function tryOpenAI(description: string): Promise<{ lines: any[] } | { error: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  
  if (!apiKey) {
    console.log("[OpenAI] Clé API non trouvée dans process.env.OPENAI_API_KEY");
    return null;
  }
  
  if (!apiKey.startsWith("sk-")) {
    console.log(`[OpenAI] Clé API invalide (ne commence pas par "sk-"): ${apiKey.substring(0, 10)}...`);
    return null;
  }

  console.log(`[OpenAI] Tentative avec clé API: ${apiKey.substring(0, 15)}...`);

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Description d'intervention : "${description.trim()}"\n\nRetourne uniquement le JSON, rien d'autre.` },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error("[OpenAI] Aucun contenu dans la réponse");
      return { error: "OpenAI n'a retourné aucun contenu" };
    }

    const parsed = JSON.parse(content);
    const validated = ResponseSchema.safeParse(parsed);
    if (validated.success && validated.data.lines.length > 0) {
      console.log(`[OpenAI] Succès ! ${validated.data.lines.length} lignes générées`);
      return { lines: validated.data.lines };
    } else {
      console.error("[OpenAI] Validation échouée:", validated.error);
      return { error: `Format de réponse invalide: ${validated.error?.message ?? "Validation échouée"}` };
    }
  } catch (e: any) {
    console.error("[OpenAI] Exception:", e.message || e);
    // Gérer spécifiquement les erreurs de quota
    if (e.status === 429 || e.message?.includes("quota") || e.message?.includes("429")) {
      return { error: "OpenAI: Quota dépassé. Vérifiez votre plan et facturation sur https://platform.openai.com" };
    }
    if (e.status === 401 || e.message?.includes("401") || e.message?.includes("Invalid API key")) {
      return { error: "OpenAI: Clé API invalide. Vérifiez OPENAI_API_KEY dans .env.local" };
    }
    return { error: `Erreur OpenAI: ${e.message || "Erreur inconnue"}` };
  }
}

const FALLBACK_MESSAGE = "Impossible de générer automatiquement. Vous pouvez continuer en mode manuel.";
const GenerateQuoteLinesInputSchema = z.object({
  description: z.string().min(1),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (!checkRateLimit(garageId)) {
      return NextResponse.json({ error: "Trop de requêtes. Réessayez dans une minute." }, { status: 429 });
    }
    const featureOk = await isFeatureEnabledForGarage(garageId, "ai_generate_lines");
    if (!featureOk) {
      return NextResponse.json({ error: "Fonctionnalité désactivée pour ce garage." }, { status: 403 });
    }
    const quota = await checkAiQuota(garageId);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: "Quota IA atteint. Contactez le support ou augmentez votre plan.", quotaExceeded: true },
        { status: 200 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = GenerateQuoteLinesInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides. Vérifiez les champs." }, { status: 400 });
    }
    const description = parsed.data.description.trim();
    const vehicleMake = parsed.data.vehicle_make?.trim() ?? undefined;
    const vehicleModel = parsed.data.vehicle_model?.trim() ?? undefined;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const safeResult = await safeAiCall({
      garageId,
      userId,
      feature: "generate_quote_lines",
      fn: async () => {
        let result: { lines: any[] } | { error: string } | null = await tryMistral(description);
        if (result && "error" in result) result = await tryGemini(description);
        if (result && "error" in result) result = await tryOpenAI(description);
        return result;
      },
    });

    if (safeResult.error) {
      await logAiEvent(garageId, userId, "generate_quote_lines", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: safeResult.error }, { status: 200 });
    }
    const result = safeResult.data;
    if (result == null) {
      await logAiEvent(garageId, userId, "generate_quote_lines", "error", safeResult.latencyMs);
      return NextResponse.json(
        { fallback: true, error: "Aucune API IA configurée. Configurez MISTRAL_API_KEY, GEMINI_API_KEY ou OPENAI_API_KEY." },
        { status: 200 }
      );
    }
    if ("error" in result) {
      await logAiEvent(garageId, userId, "generate_quote_lines", "error", safeResult.latencyMs);
      return NextResponse.json({ fallback: true, error: FALLBACK_MESSAGE }, { status: 200 });
    }
    
    // Post-traitement premium : regrouper micro-lignes et éléments inclus
    let processedLines = result.lines;
    try {
      processedLines = postProcessQuoteItems(result.lines);
      
      // Re-valider les lignes post-traitées pour s'assurer qu'elles respectent toujours le schéma
      const revalidated = ResponseSchema.safeParse({ lines: processedLines });
      if (revalidated.success) {
        processedLines = revalidated.data.lines;
      } else {
        // Si la validation échoue après post-traitement, utiliser les lignes originales (fallback)
        console.warn("[generate-quote-lines] Post-traitement a produit des lignes invalides, utilisation des lignes originales:", revalidated.error);
        processedLines = result.lines;
      }
    } catch (postProcessError) {
      // En cas d'erreur dans le post-traitement, utiliser les lignes originales (fallback)
      console.error("[generate-quote-lines] Erreur lors du post-traitement:", postProcessError);
      processedLines = result.lines;
    }

    const usePriceMemory = await isPriceMemoryEnabled(garageId);
    if (usePriceMemory && processedLines.length > 0) {
      const typeMap: Record<string, "part" | "labor" | "forfait"> = {
        piece: "part",
        main_oeuvre: "labor",
        forfait: "forfait",
      };
      for (const line of processedLines) {
        const itemKey = normalizeKey(line.description ?? "");
        if (!itemKey) continue;
        const itemType = typeMap[line.type] ?? "part";
        const memPrice = await getPriceMemory(garageId, itemType, itemKey, vehicleMake, vehicleModel);
        if (memPrice != null && typeof line.unit_price_ht === "number") {
          line.unit_price_ht = memPrice;
        }
      }
    }
    
    await recordAiUsage(garageId);
    await logAiEvent(garageId, userId, "generate_quote_lines", "success", safeResult.latencyMs);
    return NextResponse.json({ lines: processedLines });
  } catch {
    return NextResponse.json({ error: FALLBACK_MESSAGE }, { status: 200 });
  }
}
