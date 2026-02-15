/**
 * Post-traitement "Premium" des lignes de devis générées par l'IA.
 * 
 * Objectif : Transformer des devis avec trop de micro-lignes en devis lisibles,
 * premium, orientés conversion (3-8 lignes max par section).
 * 
 * Règles :
 * - Regroupe les micro-lignes de main-d'œuvre (≤0.5h) avec la ligne principale
 * - Regroupe les lignes à 0€ en "Contrôles & sécurité (Inclus)" ou dans la description principale
 * - Préserve les options séparées avec mention "Option recommandée"
 * - Corrige les descriptions tronquées
 * - Préserve les totaux à l'euro près
 */

export type AiQuoteLine = {
  type: "piece" | "main_oeuvre" | "forfait";
  description: string;
  quantity: number;
  unit: "unite" | "heure";
  unit_price_ht: number;
  isOption: boolean;
  isIncluded: boolean;
};

/**
 * Détecte la famille de travail d'une ligne (freinage, vidange, distribution, etc.)
 * pour permettre le regroupement logique.
 */
function detectWorkFamily(description: string): string | null {
  const descLower = description.toLowerCase();
  
  // Familles de travail par mots-clés
  const families: Record<string, string[]> = {
    freinage: ["frein", "plaquette", "disque", "étrier", "liquide frein", "purge frein"],
    vidange: ["vidange", "huile moteur", "filtre huile", "huile boîte"],
    distribution: ["distribution", "courroie", "tendeur", "pompe eau"],
    climatisation: ["climatisation", "clim", "gaz", "recharge clim", "filtre habitacle"],
    pneus: ["pneu", "pneus", "équilibrage", "géométrie", "parallélisme"],
    batterie: ["batterie", "alternateur", "démarreur", "charge batterie"],
    éclairage: ["phare", "ampoule", "éclairage", "feu"],
    suspension: ["suspension", "amortisseur", "rotule", "biellette"],
    moteur: ["bougie", "filtre air", "injecteur", "vanne egr"],
  };
  
  for (const [family, keywords] of Object.entries(families)) {
    if (keywords.some(keyword => descLower.includes(keyword))) {
      return family;
    }
  }
  
  return null;
}

/**
 * Vérifie si une description est tronquée (se termine par "..." ou semble incomplète).
 * Détecte aussi les descriptions finissant par "(", "—", "+", texte coupé.
 * Version améliorée et plus agressive pour détecter tous les cas.
 */
function isTruncated(description: string): boolean {
  const trimmed = description.trim();
  
  // Si description vide ou trop courte
  if (!trimmed || trimmed.length === 0) {
    return true;
  }
  
  // Détecter les fins incomplètes avec symboles
  if (trimmed.endsWith("...") || 
      trimmed.endsWith("…") ||
      trimmed.endsWith("(") ||
      trimmed.endsWith("—") ||
      trimmed.endsWith("+") ||
      trimmed.endsWith("-") ||
      trimmed.endsWith("/") ||
      trimmed.endsWith(",")) {
    return true;
  }
  
  // Détecter les parenthèses ouvertes non fermées
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    return true;
  }
  
  // Détecter les descriptions qui semblent coupées (finissent par un espace suivi de rien)
  if (description.endsWith(" ") && trimmed.length < 30) {
    return true;
  }
  
  // Détecter les descriptions trop courtes sans contexte valide
  if (trimmed.length < 15 && !trimmed.includes("—") && !trimmed.includes("-") && !trimmed.match(/\d/) && !trimmed.match(/^[A-Z]/)) {
    return true;
  }
  
  // Détecter les cas spécifiques comme "Option recommandée — Ne" (mot incomplet après "—")
  if (trimmed.includes("—")) {
    const parts = trimmed.split("—");
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].trim();
      // Si la partie après "—" fait moins de 3 caractères, c'est suspect
      if (lastPart.length < 3 && lastPart.length > 0) {
        return true;
      }
    }
  }
  
  // Analyser les mots de la description pour détecter les troncatures
  const words = trimmed.split(/\s+/);
  if (words.length > 0) {
    const lastWord = words[words.length - 1];
    
    // Détecter les mots très courts suspects (ex: "Ne", "Le", etc.)
    if (lastWord.length <= 2 && trimmed.length < 25 && words.length <= 3) {
      // Exceptions : mots courts valides comme "5W30", "4L", "DOT 4"
      if (!lastWord.match(/^\d+[a-z]?\d*$/i) && !lastWord.match(/^dot$/i) && !lastWord.match(/^\d+l$/i)) {
        return true;
      }
    }
    
    // Détecter les mots incomplets en fin de description (ex: "Remplac", "Plaquettes I")
    // Si le dernier mot fait moins de 3 caractères et n'est pas un nombre/unité, c'est suspect
    if (lastWord.length < 3 && !lastWord.match(/^\d+[a-z]?$/i) && !lastWord.match(/^[a-z]$/i)) {
      // Exception : mots courts valides comme "à", "de", "en", "le", "la", "un", "une"
      const validShortWords = ["à", "de", "en", "le", "la", "un", "une", "et", "ou", "par", "sur", "sous", "dans", "pour", "avec", "sans"];
      if (!validShortWords.includes(lastWord.toLowerCase())) {
        return true;
      }
    }
    
    // Si le dernier mot est une seule lettre majuscule (ex: "I", "A", "O") et que ce n'est pas un acronyme valide
    if (lastWord.length === 1 && lastWord.match(/^[A-Z]$/) && !trimmed.match(/^[A-Z]\s/)) {
      return true;
    }
    
    // Détecter les descriptions qui finissent par des mots incomplets (ex: "Remplac" au lieu de "Remplacement")
    const incompleteWords = ["remplac", "plaquett", "consommabl", "nettoyant", "vidang", "moteur", "filtre", "frein"];
    const lastWordLower = lastWord.toLowerCase();
    if (incompleteWords.some(incomplete => lastWordLower.startsWith(incomplete) && lastWordLower.length < incomplete.length + 2)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Reformule une description tronquée pour la rendre complète.
 * Supprime les fins incomplètes et complète la description proprement.
 * Version améliorée pour gérer tous les cas de troncature.
 */
function reformulateDescription(description: string, type: string): string {
  let trimmed = description.trim();
  const descLower = trimmed.toLowerCase();
  
  // Cas spécial : "Option recommandée — Ne" ou similaire
  if (descLower.startsWith("option recommandée")) {
    const parts = trimmed.split(/[—\-]/);
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].trim();
      // Si la partie après "—" est incomplète (moins de 3 caractères)
      if (lastPart.length < 3) {
        // Essayer de déterminer le type d'option selon le contexte
        return "Option recommandée — Service complémentaire";
      }
    }
  }
  
  // Cas spécial : "Nettoyant circuit de frein (o" → compléter immédiatement
  if (descLower.includes("nettoyant") && (descLower.includes("frein") || descLower.includes("circuit"))) {
    if (trimmed.includes("(") && !trimmed.includes(")")) {
      return "Nettoyant circuit de frein";
    }
    if (trimmed.length < 25) {
      return "Nettoyant circuit de frein";
    }
  }
  
  // Cas spécial : "Consommables atelier (pro" → compléter immédiatement
  if (descLower.includes("consommable") && descLower.includes("atelier")) {
    if (trimmed.includes("(") && !trimmed.includes(")")) {
      return "Consommables atelier (produits nettoyants, chiffons, petits matériaux)";
    }
    if (trimmed.length < 25) {
      return "Consommables atelier (produits nettoyants, chiffons, petits matériaux)";
    }
  }
  
  // Cas spécial : "Remplacement Plaquettes I" → compléter immédiatement
  if (descLower.includes("remplacement") && (descLower.includes("plaquette") || descLower.includes("plaquettes"))) {
    // Si description tronquée avec parenthèse ouverte ou mot incomplet (ex: "I")
    if ((trimmed.includes("(") && !trimmed.includes(")")) || (trimmed.endsWith("I") && trimmed.length < 35)) {
      return "Remplacement plaquettes de frein avant";
    }
    // Si description semble incomplète
    if (trimmed.length < 30) {
      return "Remplacement plaquettes de frein avant";
    }
  }
  
  // Cas spécial : "Vidange Moteur + Remplac" → compléter immédiatement
  if (descLower.includes("vidange") && descLower.includes("moteur")) {
    if (descLower.includes("remplac") && !descLower.includes("remplacement")) {
      return "Vidange moteur + remplacement filtre";
    }
    if (trimmed.includes("+") && trimmed.length < 35) {
      // Vérifier si la partie après "+" est incomplète
      const parts = trimmed.split("+");
      if (parts.length > 1) {
        const afterPlus = parts[parts.length - 1].trim();
        if (afterPlus.length < 10) {
          return "Vidange moteur + remplacement filtre";
        }
      }
    }
    if (trimmed.length < 25) {
      return "Vidange moteur complète";
    }
  }
  
  // Cas spécial : "Nettoyant circuit de frein (o" → déjà géré plus haut, mais renforcer
  if (descLower.includes("nettoyant") && (descLower.includes("frein") || descLower.includes("circuit"))) {
    if (trimmed.includes("(") && !trimmed.includes(")")) {
      return "Nettoyant circuit de frein";
    }
    if (trimmed.length < 25) {
      return "Nettoyant circuit de frein";
    }
  }
  
  // Supprimer les fins incomplètes
  trimmed = trimmed
    .replace(/\.\.\.$/, "")
    .replace(/…$/, "")
    .replace(/\($/, "") // Supprimer parenthèse ouverte en fin
    .replace(/—\s*$/, "") // Supprimer em dash en fin
    .replace(/-\s*$/, "") // Supprimer tiret en fin
    .replace(/\+\s*$/, "") // Supprimer plus en fin
    .replace(/\/\s*$/, "") // Supprimer slash en fin
    .replace(/,\s*$/, "") // Supprimer virgule en fin
    .trim();
  
  // Fermer les parenthèses ouvertes ou supprimer la partie après la dernière parenthèse ouverte
  const openParens = (trimmed.match(/\(/g) || []).length;
  const closeParens = (trimmed.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    // Supprimer la dernière parenthèse ouverte et tout ce qui suit
    const lastOpenParen = trimmed.lastIndexOf("(");
    if (lastOpenParen >= 0) {
      trimmed = trimmed.substring(0, lastOpenParen).trim();
    }
  }
  
  // Cas spécial : description qui finit par un mot très court suspect après "—"
  if (trimmed.includes("—")) {
    const parts = trimmed.split("—");
    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1].trim();
      // Si la partie après "—" est incomplète (moins de 3 caractères et pas un nombre/volume)
      if (lastPart.length < 3 && !lastPart.match(/^\d+[a-z]?\d*$/i) && !lastPart.match(/^\d+l$/i)) {
        // Supprimer la partie incomplète
        trimmed = parts.slice(0, -1).join("—").trim();
      }
    }
  }
  
  // Si c'est une pièce, essayer de compléter avec des détails standards
  if (type === "piece") {
    const descLower = trimmed.toLowerCase();
    
    // Cas spécial : "Option recommandée — Ne" ou similaire
    if (descLower.startsWith("option recommandée")) {
      return "Option recommandée — Service complémentaire";
    }
    
    // Cas spécial : "Nettoyant circuit de frein (o" → compléter
    if (descLower.includes("nettoyant") && descLower.includes("frein")) {
      return "Nettoyant circuit de frein";
    }
    
    // Cas spécial : "Consommables atelier (pro" → compléter
    if (descLower.includes("consommable") && descLower.includes("atelier")) {
      return "Consommables atelier (produits nettoyants, chiffons, petits matériaux)";
    }
    
    if (trimmed.length < 20 || isTruncated(trimmed)) {
      // Description trop courte ou encore tronquée, essayer de l'enrichir
      if (descLower.includes("plaquette")) {
        return "Plaquettes de frein avant";
      }
      if (descLower.includes("disque")) {
        return "Disques de frein avant";
      }
      if (descLower.includes("huile") && !descLower.includes("moteur")) {
        return "Huile moteur 5W30 — 4L";
      }
      if (descLower.includes("huile moteur")) {
        // Préserver la viscosité si présente
        const viscosityMatch = description.match(/(\d+w\d+)/i);
        const viscosity = viscosityMatch ? viscosityMatch[1] : "5W30";
        const volumeMatch = description.match(/(\d+)\s*l/i);
        const volume = volumeMatch ? volumeMatch[1] : "4";
        return `Huile moteur ${viscosity} — ${volume}L`;
      }
      if (descLower.includes("filtre") && descLower.includes("huile")) {
        return "Filtre à huile";
      }
      if (descLower.includes("filtre")) {
        return "Filtre à huile";
      }
      if (descLower.includes("nettoyant")) {
        return "Nettoyant circuit de frein";
      }
    }
  }
  
  // Pour main-d'œuvre, essayer de compléter
  if (type === "main_oeuvre") {
    const descLower = trimmed.toLowerCase();
    
    // Cas spécial : "Remplacement plaquettes (" ou "Remplacement Plaquettes I" → compléter
    if (descLower.includes("remplacement") && (descLower.includes("plaquette") || descLower.includes("plaquettes"))) {
      // Si description tronquée avec parenthèse ouverte ou mot incomplet
      if (trimmed.includes("(") && !trimmed.includes(")") || trimmed.endsWith("I") && trimmed.length < 30) {
        return "Remplacement plaquettes de frein avant";
      }
      // Si description semble incomplète
      if (trimmed.length < 30) {
        return "Remplacement plaquettes de frein avant";
      }
    }
    
    if (trimmed.length < 20 || isTruncated(trimmed)) {
      if (descLower.includes("remplacement") && descLower.includes("plaquette")) {
        return "Remplacement plaquettes de frein avant";
      }
      if (descLower.includes("remplacement") && descLower.includes("disque")) {
        return "Remplacement disques de frein avant";
      }
      if (descLower.includes("remplacement")) {
        return "Remplacement pièce détachée";
      }
      if (descLower.includes("vidange")) {
        return "Vidange moteur complète";
      }
      if (descLower.includes("contrôle") || descLower.includes("vérif")) {
        return "Contrôles de sécurité";
      }
    }
  }
  
  // Pour forfait, compléter si tronqué
  if (type === "forfait") {
    const descLower = trimmed.toLowerCase();
    if (descLower.includes("consommable") && descLower.includes("atelier")) {
      // Si description tronquée avec parenthèse ouverte
      if (trimmed.includes("(") && !trimmed.includes(")")) {
        return "Consommables atelier (produits nettoyants, chiffons, petits matériaux)";
      }
      // Si description trop courte
      if (trimmed.length < 25) {
        return "Consommables atelier (produits nettoyants, chiffons, petits matériaux)";
      }
    }
  }
  
  // Si toujours tronquée après nettoyage, retourner une version propre minimale
  if (isTruncated(trimmed) && trimmed.length > 0) {
    // Garder les premiers mots complets (au moins 2 mots)
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      // Prendre tous les mots sauf le dernier si suspect
      const lastWord = words[words.length - 1];
      if (lastWord.length <= 2 && !lastWord.match(/^\d+[a-z]?\d*$/i)) {
        return words.slice(0, -1).join(" ");
      }
      return words.join(" ");
    }
  }
  
  // Si description vide après nettoyage, utiliser fallback
  if (!trimmed || trimmed.length === 0) {
    return getFallbackDescription(type, description);
  }
  
  return trimmed;
}

/**
 * Regroupe les micro-lignes de main-d'œuvre (≤0.5h) avec la ligne principale du même groupe.
 */
function groupMicroLaborLines(lines: AiQuoteLine[]): AiQuoteLine[] {
  const laborLines = lines.filter(l => l.type === "main_oeuvre" && !l.isOption);
  const otherLines = lines.filter(l => l.type !== "main_oeuvre" || l.isOption);
  
  if (laborLines.length === 0) return lines;
  
  // Séparer les lignes principales (≥0.5h) et les micro-lignes (<0.5h)
  const mainLines: AiQuoteLine[] = [];
  const microLines: AiQuoteLine[] = [];
  
  for (const line of laborLines) {
    if (line.quantity >= 0.5 && !line.isIncluded) {
      mainLines.push(line);
    } else {
      microLines.push(line);
    }
  }
  
  // Grouper les micro-lignes par famille de travail
  const grouped: AiQuoteLine[] = [];
  const processedMicro = new Set<number>();
  
  for (const mainLine of mainLines) {
    const family = detectWorkFamily(mainLine.description);
    const groupedMicro: AiQuoteLine[] = [];
    
    // Trouver les micro-lignes de la même famille
    for (let i = 0; i < microLines.length; i++) {
      if (processedMicro.has(i)) continue;
      
      const microLine = microLines[i];
      const microFamily = detectWorkFamily(microLine.description);
      
      // Si même famille ou si micro-ligne est incluse (0€), la regrouper
      if ((family && microFamily === family) || microLine.isIncluded) {
        groupedMicro.push(microLine);
        processedMicro.add(i);
      }
    }
    
    // Fusionner les micro-lignes avec la ligne principale
    if (groupedMicro.length > 0) {
      // Séparer les micro-lignes payantes et incluses
      const paidMicro = groupedMicro.filter(m => !m.isIncluded && m.unit_price_ht > 0);
      const includedMicro = groupedMicro.filter(m => m.isIncluded || m.unit_price_ht === 0);
      
      // Calculer la quantité totale (seulement les lignes payantes comptent pour la quantité)
      const totalQty = mainLine.quantity + paidMicro.reduce((sum, m) => sum + m.quantity, 0);
      
      // Calculer le prix total (seulement les lignes payantes)
      const totalPrice = mainLine.quantity * mainLine.unit_price_ht + 
                        paidMicro.reduce((sum, m) => sum + (m.quantity * m.unit_price_ht), 0);
      
      // Construire une description enrichie
      const paidMicroDescriptions = paidMicro
        .map(m => m.description)
        .filter((desc, idx, arr) => arr.indexOf(desc) === idx); // Dédupliquer
      
      const includedMicroDescriptions = includedMicro
        .map(m => m.description)
        .filter((desc, idx, arr) => arr.indexOf(desc) === idx); // Dédupliquer
      
      let enrichedDescription = mainLine.description;
      
      // Ajouter les micro-tâches payantes si pertinentes
      if (paidMicroDescriptions.length > 0 && paidMicroDescriptions.length <= 2) {
        enrichedDescription = `${mainLine.description} — ${paidMicroDescriptions.join(", ")}`;
      }
      
      // Ajouter les éléments inclus
      if (includedMicroDescriptions.length > 0) {
        const includedText = includedMicroDescriptions.join(", ");
        enrichedDescription = enrichedDescription.includes("inclus") 
          ? `${enrichedDescription}, ${includedText}`
          : `${enrichedDescription} — ${includedText} inclus`;
      }
      
      // Calculer le prix unitaire (éviter division par zéro)
      const unitPrice = totalQty > 0 ? totalPrice / totalQty : mainLine.unit_price_ht;
      
      grouped.push({
        ...mainLine,
        quantity: totalQty,
        unit_price_ht: Math.round(unitPrice * 100) / 100, // Arrondir à 2 décimales
        description: enrichedDescription,
        isIncluded: false, // La ligne principale n'est jamais incluse après regroupement
      });
    } else {
      grouped.push(mainLine);
    }
  }
  
  // Ajouter les micro-lignes non groupées (sans famille ou sans ligne principale)
  for (let i = 0; i < microLines.length; i++) {
    if (!processedMicro.has(i)) {
      grouped.push(microLines[i]);
    }
  }
  
  // Réorganiser : autres lignes → main-d'œuvre groupée
  const result: AiQuoteLine[] = [];
  
  // Pièces d'abord (non optionnelles)
  result.push(...otherLines.filter(l => l.type === "piece" && !l.isOption));
  // Main-d'œuvre principale (groupée)
  result.push(...grouped);
  // Options (pièces et main-d'œuvre optionnelles)
  result.push(...otherLines.filter(l => l.isOption));
  // Forfaits
  result.push(...otherLines.filter(l => l.type === "forfait" && !l.isOption));
  
  return result;
}

/**
 * Regroupe les lignes à 0€ (isIncluded=true) en une seule ligne "Contrôles & sécurité (Inclus)"
 * ou les intègre dans la description de la ligne principale si pertinente.
 */
function groupIncludedLines(lines: AiQuoteLine[]): AiQuoteLine[] {
  const includedLines = lines.filter(l => l.isIncluded && l.unit_price_ht === 0);
  const otherLines = lines.filter(l => !l.isIncluded || l.unit_price_ht !== 0);
  
  if (includedLines.length === 0) return lines;
  
  // Si plusieurs lignes incluses, les regrouper en une seule
  if (includedLines.length > 1) {
    const includedDescriptions = includedLines
      .map(l => l.description)
      .filter((desc, idx, arr) => arr.indexOf(desc) === idx) // Dédupliquer
      .filter(desc => desc.trim().length > 0);
    
    // Si on peut intégrer dans une description principale, le faire
    const mainLaborLine = otherLines.find(l => 
      l.type === "main_oeuvre" && 
      !l.isOption && 
      l.quantity >= 0.5 &&
      !l.description.toLowerCase().includes("inclus")
    );
    
    if (mainLaborLine && includedDescriptions.length > 0) {
      // Enrichir la description principale avec les éléments inclus
      const includedText = includedDescriptions.join(", ");
      mainLaborLine.description = `${mainLaborLine.description} — ${includedText} inclus`;
      
      return [...otherLines];
    }
    
    // Sinon, créer une ligne regroupée
    if (includedDescriptions.length > 0) {
      // Limiter la description à une longueur raisonnable
      const includedText = includedDescriptions.length > 3 
        ? `${includedDescriptions.slice(0, 3).join(", ")} et autres contrôles`
        : includedDescriptions.join(", ");
      
      const groupedIncluded: AiQuoteLine = {
        type: "main_oeuvre",
        description: `Contrôles & sécurité (Inclus) — ${includedText}`,
        quantity: 1, // Quantité minimale pour respecter le schéma (positive)
        unit: "heure",
        unit_price_ht: 0,
        isOption: false,
        isIncluded: true,
      };
      
      return [...otherLines, groupedIncluded];
    }
    
    return otherLines;
  }
  
  // Une seule ligne incluse : essayer de l'intégrer dans la ligne principale
  const singleIncluded = includedLines[0];
  const mainLaborLine = otherLines.find(l => 
    l.type === "main_oeuvre" && 
    !l.isOption && 
    l.quantity >= 0.5 &&
    !l.description.toLowerCase().includes("inclus")
  );
  
  if (mainLaborLine && singleIncluded.description.trim().length > 0) {
    mainLaborLine.description = `${mainLaborLine.description} — ${singleIncluded.description} inclus`;
    return otherLines;
  }
  
  // S'assurer que la ligne incluse a une quantité valide (positive)
  const validIncluded: AiQuoteLine = {
    ...singleIncluded,
    quantity: singleIncluded.quantity > 0 ? singleIncluded.quantity : 1, // Quantité minimale pour respecter le schéma
  };
  
  return [...otherLines, validIncluded];
}

/**
 * Ajoute le préfixe "Option recommandée — " aux options si absent.
 */
function enrichOptions(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines.map(line => {
    if (line.isOption && !line.description.toLowerCase().startsWith("option")) {
      return {
        ...line,
        description: `Option recommandée — ${line.description}`,
      };
    }
    return line;
  });
}

/**
 * Corrige les descriptions tronquées et supprime les lignes invalides.
 * Plus agressif : détecte et corrige toutes les descriptions incomplètes.
 */
function fixTruncatedDescriptions(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines
    .map(line => {
      // Vérifier si la description est valide
      const desc = line.description.trim();
      
      // Supprimer les lignes avec description vide ou invalide
      if (!desc || desc.length === 0) {
        return null;
      }
      
      // Supprimer les lignes qui ne sont que des nombres ou durées sans contexte
      if (/^\d+\.?\d*\s*h$/i.test(desc) || /^\d+\.?\d*$/.test(desc)) {
        return null; // Ligne invalide (ex: "2.0h" seul)
      }
      
      // Vérifier et corriger si tronquée
      if (isTruncated(desc)) {
        const corrected = reformulateDescription(desc, line.type);
        // Si la correction échoue ou produit encore une description invalide, essayer une dernière fois
        if (!corrected || corrected.trim().length === 0 || isTruncated(corrected)) {
          // Dernière tentative : utiliser une description générique selon le type
          const fallbackDesc = getFallbackDescription(line.type, desc);
          return {
            ...line,
            description: fallbackDesc,
          };
        }
        return {
          ...line,
          description: corrected,
        };
      }
      
      return line;
    })
    .filter((line): line is AiQuoteLine => line !== null); // Supprimer les lignes null
}

/**
 * Génère une description de secours si la correction échoue.
 */
function getFallbackDescription(type: string, originalDesc: string): string {
  const descLower = originalDesc.toLowerCase();
  
  if (type === "piece") {
    if (descLower.includes("plaquette")) return "Plaquettes de frein avant";
    if (descLower.includes("disque")) return "Disques de frein avant";
    if (descLower.includes("huile")) return "Huile moteur 5W30 — 4L";
    if (descLower.includes("filtre")) return "Filtre à huile";
    if (descLower.includes("nettoyant") && descLower.includes("frein")) return "Nettoyant circuit de frein";
    if (descLower.includes("nettoyant")) return "Nettoyant circuit de frein";
    if (descLower.includes("option")) return "Option recommandée — Service complémentaire";
    return "Pièce détachée";
  }
  
  if (type === "main_oeuvre") {
    if (descLower.includes("plaquette") || descLower.includes("frein")) return "Remplacement plaquettes de frein avant";
    if (descLower.includes("vidange") && descLower.includes("remplac")) return "Vidange moteur + remplacement filtre";
    if (descLower.includes("vidange")) return "Vidange moteur complète";
    if (descLower.includes("remplacement")) return "Remplacement pièce détachée";
    if (descLower.includes("remplac")) return "Remplacement pièce détachée";
    return "Intervention mécanique";
  }
  
  if (type === "forfait") {
    if (descLower.includes("consommable")) return "Consommables atelier (produits nettoyants, chiffons, petits matériaux)";
    return "Forfait atelier";
  }
  
  return "Ligne de devis";
}

/**
 * Regroupe intelligemment les huiles moteur en quantité > 1.
 * Transforme "Huile moteur 5W30 — 4L" x2 en "Huile moteur 5W30 — 8L (2 bidons de 4L)".
 * Ne modifie que la description, conserve le prix total identique.
 */
function groupOilQuantities(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines.map(line => {
    // Ne traiter que les pièces d'huile moteur avec quantité > 1
    if (line.type !== "piece" || line.quantity <= 1) return line;
    
    const descLower = line.description.toLowerCase();
    if (!descLower.includes("huile moteur") && !descLower.includes("huile 5w") && !descLower.includes("huile 10w")) {
      return line;
    }
    
    // Extraire le volume unitaire de la description (ex: "4L", "5L")
    const volumeMatch = line.description.match(/(\d+)\s*l/i);
    if (!volumeMatch) return line; // Si volume non détectable, ne rien modifier
    
    const unitVolume = parseInt(volumeMatch[1], 10);
    const totalVolume = Math.round(line.quantity * unitVolume);
    
    // Extraire la viscosité si présente
    const viscosityMatch = line.description.match(/(\d+w\d+)/i);
    const viscosity = viscosityMatch ? viscosityMatch[1] : "5W30";
    
    // Construire la nouvelle description
    const newDescription = `Huile moteur ${viscosity} — ${totalVolume}L (${line.quantity} bidon${line.quantity > 1 ? 's' : ''} de ${unitVolume}L)`;
    
    return {
      ...line,
      description: newDescription,
    };
  });
}

/**
 * Enrichit légèrement les forfaits consommables si description trop vague.
 * Remplace "Consommables atelier" par "Consommables atelier (produits nettoyants, chiffons, petits matériaux)".
 */
function enrichConsumablesForfait(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines.map(line => {
    if (line.type !== "forfait") return line;
    
    const descLower = line.description.toLowerCase();
    
    // Seulement si la description est trop vague
    if (descLower === "consommables atelier" || descLower === "consommables" || descLower.trim() === "consommables atelier") {
      return {
        ...line,
        description: "Consommables atelier (produits nettoyants, chiffons, petits matériaux)",
      };
    }
    
    return line;
  });
}

/**
 * Valide et corrige les durées réalistes pour la main-d'œuvre.
 * - Vérifie qu'aucune ligne MO n'a 0h
 * - Vérifie que les durées sont réalistes (min 0.25h, arrondi à 0.05h)
 * - Corrige automatiquement les durées invalides
 */
function validateRealisticDurations(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines.map(line => {
    if (line.type !== "main_oeuvre" || line.isIncluded) return line;
    
    let qty = line.quantity;
    
    // Si durée à 0h, soit supprimer soit intégrer dans une autre ligne
    if (qty === 0 || qty < 0.25) {
      // Si très petite durée (< 0.25h), arrondir à 0.25h minimum
      qty = 0.25;
    }
    
    // Arrondir à 0.05h près (ex: 0.73h → 0.75h, 0.12h → 0.15h)
    qty = Math.round(qty * 20) / 20;
    
    // S'assurer que c'est au moins 0.25h
    if (qty < 0.25) {
      qty = 0.25;
    }
    
    return {
      ...line,
      quantity: qty,
    };
  }).filter(line => {
    // Supprimer les lignes MO avec 0h ou quantité invalide
    if (line.type === "main_oeuvre" && !line.isIncluded && line.quantity <= 0) {
      return false;
    }
    return true;
  });
}

/**
 * Valide que les totaux sont préservés (à l'euro près).
 */
function validateTotals(original: AiQuoteLine[], processed: AiQuoteLine[]): boolean {
  const originalTotal = original.reduce((sum, l) => {
    return sum + (l.quantity * l.unit_price_ht);
  }, 0);
  
  const processedTotal = processed.reduce((sum, l) => {
    return sum + (l.quantity * l.unit_price_ht);
  }, 0);
  
  // Tolérance de 0.01€ pour les arrondis
  return Math.abs(originalTotal - processedTotal) < 0.01;
}

/**
 * Normalise une description pour comparaison (lowercase, sans accents, sans ponctuation).
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprimer accents
    .replace(/[^\w\s]/g, " ") // Remplacer ponctuation par espaces
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calcule la similarité entre deux descriptions (0-1).
 */
function calculateSimilarity(desc1: string, desc2: string): number {
  const norm1 = normalizeForComparison(desc1);
  const norm2 = normalizeForComparison(desc2);
  
  if (norm1 === norm2) return 1.0;
  
  // Similarité par mots communs
  const words1 = new Set(norm1.split(/\s+/));
  const words2 = new Set(norm2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  
  return intersection.size / union.size;
}

/**
 * Détecte et fusionne les lignes quasi identiques (même produit/service).
 * Exemple : "Huile moteur 5W30 — 5L" x2 → 1 ligne avec quantité additionnée.
 */
function deduplicateLines(lines: AiQuoteLine[]): AiQuoteLine[] {
  if (lines.length <= 1) return lines;
  
  const result: AiQuoteLine[] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < lines.length; i++) {
    if (processed.has(i)) continue;
    
    const currentLine = lines[i];
    const duplicates: number[] = [i];
    
    // Chercher les doublons
    for (let j = i + 1; j < lines.length; j++) {
      if (processed.has(j)) continue;
      
      const otherLine = lines[j];
      
      // Vérifier si c'est un doublon potentiel
      const similarity = calculateSimilarity(currentLine.description, otherLine.description);
      const sameType = currentLine.type === otherLine.type;
      const sameUnit = currentLine.unit === otherLine.unit;
      const priceDiff = Math.abs(currentLine.unit_price_ht - otherLine.unit_price_ht);
      const priceSimilar = priceDiff < 0.01 || (currentLine.unit_price_ht > 0 && priceDiff / currentLine.unit_price_ht < 0.05); // 5% de tolérance
      
      // Détection améliorée : même si descriptions légèrement différentes, si c'est clairement la même pièce
      const desc1Lower = currentLine.description.toLowerCase();
      const desc2Lower = otherLine.description.toLowerCase();
      
      // Détecter les cas spéciaux (ex: "Plaquettes de frein avant" vs "Plaquettes avant")
      const isSamePiece = 
        (desc1Lower.includes("plaquette") && desc2Lower.includes("plaquette") && desc1Lower.includes("frein") && desc2Lower.includes("frein")) ||
        (desc1Lower.includes("huile moteur") && desc2Lower.includes("huile moteur")) ||
        (desc1Lower.includes("filtre à huile") && desc2Lower.includes("filtre") && desc2Lower.includes("huile")) ||
        (desc1Lower.includes("disque") && desc2Lower.includes("disque") && desc1Lower.includes("frein") && desc2Lower.includes("frein"));
      
      // Si similarité > 75% (plus agressif) OU même pièce détectée ET même type ET même unité ET prix similaire → doublon
      if ((similarity > 0.75 || isSamePiece) && sameType && sameUnit && priceSimilar && !currentLine.isOption && !otherLine.isOption) {
        duplicates.push(j);
      }
    }
    
    if (duplicates.length > 1) {
      // Fusionner les doublons
      const merged: AiQuoteLine = {
        ...currentLine,
        quantity: duplicates.reduce((sum, idx) => sum + lines[idx].quantity, 0),
        // Garder la description la plus complète
        description: duplicates.reduce((best, idx) => {
          const desc = lines[idx].description;
          return desc.length > best.length ? desc : best;
        }, currentLine.description),
      };
      
      // Si les prix sont différents, utiliser le prix moyen pondéré
      const totalPrice = duplicates.reduce((sum, idx) => {
        const line = lines[idx];
        return sum + (line.quantity * line.unit_price_ht);
      }, 0);
      merged.unit_price_ht = merged.quantity > 0 
        ? Math.round((totalPrice / merged.quantity) * 100) / 100 
        : currentLine.unit_price_ht;
      
      result.push(merged);
      duplicates.forEach(idx => processed.add(idx));
    } else {
      result.push(currentLine);
      processed.add(i);
    }
  }
  
  return result;
}

/**
 * Transforme les descriptions vagues en actions explicites client-friendly.
 * Exemple : "Freinage — Remplacement" → "Remplacement plaquettes avant (contrôles et essai inclus)"
 */
function improveClientFriendlyDescriptions(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines.map(line => {
    let desc = line.description;
    const descLower = desc.toLowerCase();
    
    // Patterns de remplacement pour descriptions vagues
    const replacements: Array<{ pattern: RegExp; replacement: string }> = [
      // Main-d'œuvre vague → explicite
      {
        pattern: /^freinage\s*[—\-]\s*remplacement$/i,
        replacement: "Remplacement plaquettes avant (contrôles et essai inclus)",
      },
      {
        pattern: /^vidange$/i,
        replacement: "Vidange moteur + remplacement filtre",
      },
      {
        pattern: /^vidange\s+moteur$/i,
        replacement: "Vidange moteur + remplacement filtre",
      },
      {
        pattern: /^remplacement\s+plaquettes$/i,
        replacement: "Remplacement plaquettes avant (contrôles et essai inclus)",
      },
      {
        pattern: /^remplacement\s+disques$/i,
        replacement: "Remplacement disques avant (contrôles et essai inclus)",
      },
      {
        pattern: /^montage\s+pneu$/i,
        replacement: "Montage pneus + équilibrage",
      },
    ];
    
    // Appliquer les remplacements
    for (const { pattern, replacement } of replacements) {
      if (pattern.test(desc)) {
        desc = replacement;
        break;
      }
    }
    
    // Améliorer les descriptions de pièces vagues
    if (line.type === "piece") {
      if (descLower.includes("plaquette") && !descLower.includes("frein") && !descLower.includes("avant") && !descLower.includes("arrière")) {
        desc = desc.replace(/plaquette/i, "Plaquettes de frein avant");
      }
      if (descLower.includes("disque") && !descLower.includes("frein") && !descLower.includes("avant") && !descLower.includes("arrière")) {
        desc = desc.replace(/disque/i, "Disques de frein avant");
      }
      if (descLower.includes("huile") && !descLower.includes("moteur") && !descLower.includes("5w30") && !descLower.includes("5w-30")) {
        desc = desc.replace(/huile/i, "Huile moteur 5W30");
      }
      if (descLower.includes("pneu") && !descLower.includes("paire") && !descLower.includes("avant") && !descLower.includes("arrière")) {
        // Si plusieurs pneus, regrouper
        if (line.quantity >= 2) {
          desc = desc.replace(/pneu/i, "Pneus avant — Paire (2 pneus)");
        }
      }
    }
    
    // Limiter la longueur (6-10 mots max idéalement)
    const words = desc.split(/\s+/);
    if (words.length > 12) {
      // Garder les premiers mots importants
      desc = words.slice(0, 10).join(" ") + (words.length > 10 ? "..." : "");
    }
    
    return {
      ...line,
      description: desc,
    };
  });
}

/**
 * Normalise le formatage des descriptions (casse, séparateurs).
 */
function normalizeFormatting(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines.map(line => {
    let desc = line.description;
    
    // Remplacer les séparateurs incohérents par "—" (em dash)
    // Garder "+" pour actions combinées
    desc = desc
      .replace(/\s*[-–]\s*(?![+\d])/g, " — ") // Remplacer "-" et "–" par "—" sauf si suivi de + ou chiffre
      .replace(/\s*\/\s*(?![+\d])/g, " — ") // Remplacer "/" par "—" sauf si suivi de + ou chiffre
      .replace(/\s*\+\s*/g, " + ") // Normaliser "+"
      .replace(/\s*—\s*/g, " — "); // Normaliser "—"
    
    // Casse uniforme : Première lettre majuscule pour chaque mot important
    // Mais préserver les acronymes (5W30, PSA, etc.)
    desc = desc.split(" — ").map(part => {
      // Préserver les acronymes et références techniques
      if (/^\d+[a-z]\d+/i.test(part) || /^(psa|renault|dot|rn\d+)/i.test(part)) {
        return part;
      }
      
      // Capitaliser chaque mot
      return part
        .split(" ")
        .map(word => {
          if (word.length === 0) return word;
          // Préserver les acronymes
          if (/^[A-Z]{2,}$/.test(word)) return word;
          // Capitaliser première lettre
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
    }).join(" — ");
    
    // Nettoyer les espaces multiples
    desc = desc.replace(/\s+/g, " ").trim();
    
    return {
      ...line,
      description: desc,
    };
  });
}

/**
 * Valide la cohérence mécanique (viscosités, pièces compatibles).
 * Retourne les lignes corrigées si incohérence détectée.
 */
function validateMechanicalConsistency(lines: AiQuoteLine[]): AiQuoteLine[] {
  const result: AiQuoteLine[] = [];
  const oilLines: AiQuoteLine[] = [];
  const otherLines: AiQuoteLine[] = [];
  
  // Séparer les lignes d'huile moteur des autres
  for (const line of lines) {
    const descLower = line.description.toLowerCase();
    if (line.type === "piece" && (descLower.includes("huile moteur") || descLower.includes("huile 5w") || descLower.includes("huile 10w"))) {
      oilLines.push(line);
    } else {
      otherLines.push(line);
    }
  }
  
  // Si plusieurs huiles avec viscosités différentes, garder la première et supprimer les autres
  if (oilLines.length > 1) {
    const viscosities = new Set<string>();
    const firstOil = oilLines[0];
    
    // Extraire la viscosité de la première huile
    const firstViscosityMatch = firstOil.description.match(/(\d+w\d+)/i);
    const firstViscosity = firstViscosityMatch ? firstViscosityMatch[1].toUpperCase() : null;
    
    if (firstViscosity) {
      viscosities.add(firstViscosity);
      result.push(firstOil);
      
      // Supprimer les autres huiles avec viscosités différentes
      for (let i = 1; i < oilLines.length; i++) {
        const oil = oilLines[i];
        const viscosityMatch = oil.description.match(/(\d+w\d+)/i);
        const viscosity = viscosityMatch ? viscosityMatch[1].toUpperCase() : null;
        
        // Si même viscosité, fusionner les quantités
        if (viscosity === firstViscosity) {
          const existingOil = result.find(r => r.description === firstOil.description);
          if (existingOil) {
            existingOil.quantity += oil.quantity;
            // Recalculer le prix unitaire moyen pondéré
            const totalPrice = (firstOil.quantity * firstOil.unit_price_ht) + (oil.quantity * oil.unit_price_ht);
            existingOil.unit_price_ht = (firstOil.quantity + oil.quantity) > 0 
              ? Math.round((totalPrice / (firstOil.quantity + oil.quantity)) * 100) / 100 
              : firstOil.unit_price_ht;
          }
        }
        // Sinon, ignorer cette huile (viscosité différente)
      }
    } else {
      // Si pas de viscosité détectée, garder la première
      result.push(firstOil);
    }
  } else if (oilLines.length === 1) {
    result.push(oilLines[0]);
  }
  
  // Ajouter les autres lignes
  result.push(...otherLines);
  
  return result;
}

/**
 * Assure la cohérence du wording entre pièces et main-d'œuvre.
 * Si une pièce "Plaquettes de frein avant" existe, la MO doit utiliser "plaquettes de frein avant" et non "Freinage — Remplacement".
 */
function ensurePieceLaborConsistency(lines: AiQuoteLine[]): AiQuoteLine[] {
  const pieces = lines.filter(l => l.type === "piece" && !l.isOption);
  const laborLines = lines.filter(l => l.type === "main_oeuvre" && !l.isOption);
  const otherLines = lines.filter(l => l.type !== "main_oeuvre" || l.isOption);
  
  if (pieces.length === 0 || laborLines.length === 0) return lines;
  
  // Extraire les termes techniques des pièces
  const pieceTerms: Map<string, string> = new Map();
  
  for (const piece of pieces) {
    const descLower = piece.description.toLowerCase();
    
    // Détecter les types de pièces courantes
    if (descLower.includes("plaquette")) {
      const position = descLower.includes("avant") ? "avant" : descLower.includes("arrière") ? "arrière" : "avant";
      pieceTerms.set("plaquettes", `plaquettes de frein ${position}`);
    }
    if (descLower.includes("disque")) {
      const position = descLower.includes("avant") ? "avant" : descLower.includes("arrière") ? "arrière" : "avant";
      pieceTerms.set("disques", `disques de frein ${position}`);
    }
    if (descLower.includes("huile moteur")) {
      const viscosityMatch = piece.description.match(/(\d+w\d+)/i);
      const viscosity = viscosityMatch ? viscosityMatch[1] : "5W30";
      pieceTerms.set("huile", `huile moteur ${viscosity}`);
    }
    if (descLower.includes("filtre à huile") || descLower.includes("filtre huile")) {
      pieceTerms.set("filtre_huile", "filtre à huile");
    }
    if (descLower.includes("pneu")) {
      const position = descLower.includes("avant") ? "avant" : descLower.includes("arrière") ? "arrière" : "";
      pieceTerms.set("pneus", position ? `pneus ${position}` : "pneus");
    }
  }
  
  // Corriger les lignes main-d'œuvre pour utiliser le même wording
  const correctedLabor: AiQuoteLine[] = laborLines.map(labor => {
    const descLower = labor.description.toLowerCase();
    let newDesc = labor.description;
    
    // Remplacer les descriptions vagues par des descriptions cohérentes avec les pièces
    if (pieceTerms.has("plaquettes")) {
      const term = pieceTerms.get("plaquettes")!;
      if (/freinage\s*[—\-]\s*remplacement/i.test(newDesc) || /remplacement\s+plaquettes/i.test(newDesc)) {
        newDesc = `Remplacement ${term}`;
      }
    }
    
    if (pieceTerms.has("disques")) {
      const term = pieceTerms.get("disques")!;
      if (/remplacement\s+disques/i.test(newDesc)) {
        newDesc = `Remplacement ${term}`;
      }
    }
    
    if (pieceTerms.has("huile") && pieceTerms.has("filtre_huile")) {
      if (/vidange/i.test(newDesc) && !newDesc.toLowerCase().includes("filtre")) {
        newDesc = `Vidange moteur + remplacement ${pieceTerms.get("filtre_huile")}`;
      }
    }
    
    if (pieceTerms.has("pneus")) {
      const term = pieceTerms.get("pneus")!;
      if (/montage\s+pneu/i.test(newDesc)) {
        newDesc = `Montage ${term} + équilibrage`;
      }
    }
    
    return {
      ...labor,
      description: newDesc,
    };
  });
  
  return [...otherLines.filter(l => l.type === "piece" || l.isOption || l.type === "forfait"), ...correctedLabor];
}

/**
 * Supprime les descriptions vagues restantes après le post-traitement initial.
 * Interdit : "Freinage — Remplacement", "Option recommandée" seul, "Service moteur", etc.
 * Supprime aussi le texte marketing et les phrases inutiles.
 */
function improveVagueDescriptions(lines: AiQuoteLine[]): AiQuoteLine[] {
  const vaguePatterns: Array<{ pattern: RegExp; replacement: (line: AiQuoteLine, context: AiQuoteLine[]) => string }> = [
    {
      pattern: /^freinage\s*[—\-]\s*remplacement$/i,
      replacement: (line, context) => {
        // Chercher une pièce de freinage dans le contexte
        const brakePiece = context.find(l => l.type === "piece" && /plaquette|disque/i.test(l.description));
        if (brakePiece) {
          const descLower = brakePiece.description.toLowerCase();
          const position = descLower.includes("avant") ? "avant" : descLower.includes("arrière") ? "arrière" : "avant";
          return `Remplacement plaquettes de frein ${position}`;
        }
        return "Remplacement plaquettes de frein avant";
      },
    },
    {
      pattern: /^option\s+recommandée\s*[—\-]?\s*$/i,
      replacement: () => "Option recommandée — Service complémentaire",
    },
    {
      pattern: /^service\s+moteur$/i,
      replacement: () => "Contrôle et entretien moteur",
    },
    {
      pattern: /^intervention\s+diverse$/i,
      replacement: () => "Intervention mécanique",
    },
    {
      pattern: /^remplacement$/i,
      replacement: (line, context) => {
        // Chercher une pièce associée dans le contexte
        const relatedPiece = context.find(l => l.type === "piece" && l !== line);
        if (relatedPiece) {
          return `Remplacement ${relatedPiece.description.toLowerCase()}`;
        }
        return "Remplacement pièce détachée";
      },
    },
  ];
  
  return lines.map(line => {
    let desc = line.description;
    
    // Supprimer le texte marketing et les phrases longues (plus agressif)
    // Garder uniquement le libellé propre
    desc = desc
      .replace(/\([^)]*contrôle[^)]*\)/gi, "") // Supprimer les parenthèses avec "contrôle"
      .replace(/\([^)]*inclus[^)]*\)/gi, "") // Supprimer les parenthèses avec "inclus"
      .replace(/\([^)]*essai[^)]*\)/gi, "") // Supprimer les parenthèses avec "essai"
      .replace(/\([^)]*vérification[^)]*\)/gi, "") // Supprimer les parenthèses avec "vérification"
      .replace(/\s*—\s*[^—]+contrôle[^—]*/gi, "") // Supprimer les parties après "—" contenant "contrôle"
      .replace(/\s*—\s*[^—]+inclus[^—]*/gi, "") // Supprimer les parties après "—" contenant "inclus"
      .replace(/\s*\([^)]*\)/g, "") // Supprimer toutes les parenthèses restantes
      .replace(/\s+/g, " ") // Normaliser les espaces
      .trim();
    
    // Appliquer les patterns de remplacement
    for (const { pattern, replacement } of vaguePatterns) {
      if (pattern.test(desc)) {
        desc = replacement(line, lines);
        break;
      }
    }
    
    // Vérifier si la description est tronquée (se termine par "N…" ou similaire)
    if (/n\s*\.\.\./i.test(desc) || /n\s*…/i.test(desc)) {
      // Essayer de compléter basé sur le contexte
      if (line.isOption) {
        desc = desc.replace(/n\s*\.\.\./i, "Service complémentaire").replace(/n\s*…/i, "Service complémentaire");
      } else {
        desc = desc.replace(/n\s*\.\.\./i, "").replace(/n\s*…/i, "").trim();
      }
    }
    
    // Nettoyer les descriptions trop longues (limiter strictement à 50 caractères pour les libellés)
    if (desc.length > 50 && !line.isOption) {
      // Garder les premiers mots importants
      const words = desc.split(/\s+/);
      if (words.length > 8) {
        desc = words.slice(0, 8).join(" ");
      }
      // Si toujours trop long, tronquer à 50 caractères en préservant les mots complets
      if (desc.length > 50) {
        const truncated = desc.substring(0, 47);
        const lastSpace = truncated.lastIndexOf(" ");
        desc = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
      }
    }
    
    return {
      ...line,
      description: desc,
    };
  });
}

/**
 * Améliore les descriptions d'options pour qu'elles soient explicites.
 * Interdit : "Option recommandée — N…", "Option atelier", "Option sécurité".
 */
function improveOptionDescriptions(lines: AiQuoteLine[]): AiQuoteLine[] {
  return lines.map(line => {
    if (!line.isOption) return line;
    
    let desc = line.description;
    const descLower = desc.toLowerCase();
    
    // Si description commence par "Option recommandée" mais est tronquée ou vague
    if (/^option\s+recommandée\s*[—\-]\s*n/i.test(descLower) || /^option\s+recommandée\s*[—\-]?\s*$/i.test(descLower)) {
      // Essayer de déterminer le type d'option basé sur le contexte
      const context = lines.filter(l => !l.isOption);
      const hasBrakes = context.some(l => /frein|plaquette|disque/i.test(l.description));
      const hasOil = context.some(l => /huile|vidange/i.test(l.description));
      
      if (hasBrakes) {
        desc = "Nettoyant circuit de frein (option recommandée)";
      } else if (hasOil) {
        desc = "Additif moteur préventif (option recommandée)";
      } else {
        desc = "Service complémentaire (option recommandée)";
      }
    }
    
    // Si description est juste "Option atelier" ou "Option sécurité"
    if (/^option\s+atelier$/i.test(descLower)) {
      desc = "Service complémentaire atelier (option recommandée)";
    }
    
    if (/^option\s+sécurité$/i.test(descLower) || /^option\s+securite$/i.test(descLower)) {
      desc = "Contrôle sécurité renforcé (option recommandée)";
    }
    
    // S'assurer que chaque option a une description complète
    if (desc.length < 15 && !descLower.includes("option recommandée")) {
      desc = `${desc} (option recommandée)`;
    }
    
    return {
      ...line,
      description: desc,
    };
  });
}

/**
 * Regroupe intelligemment les interventions liées (ex: huile + filtre → une seule ligne MO).
 * Logique métier garage : regroupe les interventions qui font partie de la même opération.
 */
function groupRelatedInterventions(lines: AiQuoteLine[]): AiQuoteLine[] {
  const pieces = lines.filter(l => l.type === "piece" && !l.isOption);
  const laborLines = lines.filter(l => l.type === "main_oeuvre" && !l.isOption && !l.isIncluded);
  const otherLines = lines.filter(l => (l.type !== "main_oeuvre" && l.type !== "piece") || l.isOption || l.isIncluded);
  
  if (laborLines.length === 0) return lines;
  
  // Détecter les interventions liées (vidange + filtre, freinage complet, etc.)
  const groupedLabor: AiQuoteLine[] = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < laborLines.length; i++) {
    if (processed.has(i)) continue;
    
    const current = laborLines[i];
    const descLower = current.description.toLowerCase();
    
    // Chercher des interventions liées
    let related: AiQuoteLine[] = [current];
    processed.add(i);
    
    // Vidange + filtre → regrouper en une seule ligne (détection améliorée)
    if (descLower.includes("vidange") && !descLower.includes("filtre")) {
      const filtreLine = laborLines.find((l, idx) => 
        !processed.has(idx) && 
        (l.description.toLowerCase().includes("filtre") || 
         l.description.toLowerCase().includes("remplacement filtre") ||
         l.description.toLowerCase().includes("changement filtre")) &&
        l.quantity <= 0.75 // Accepter jusqu'à 0.75h pour le filtre
      );
      if (filtreLine) {
        const filtreIdx = laborLines.indexOf(filtreLine);
        related.push(filtreLine);
        processed.add(filtreIdx);
      }
    }
    
    // Si filtre seul et vidange existe → regrouper avec vidange (détection améliorée)
    if ((descLower.includes("filtre") || descLower.includes("changement filtre")) && !descLower.includes("vidange")) {
      const vidangeLine = laborLines.find((l, idx) => 
        !processed.has(idx) && 
        (l.description.toLowerCase().includes("vidange") ||
         l.description.toLowerCase().includes("vidange moteur")) &&
        !l.description.toLowerCase().includes("filtre")
      );
      if (vidangeLine) {
        const vidangeIdx = laborLines.indexOf(vidangeLine);
        // Retirer current de related et ajouter vidange en premier
        related = [vidangeLine, current];
        processed.delete(i);
        processed.add(vidangeIdx);
        processed.add(i);
      }
    }
    
    // Freinage complet → regrouper les micro-interventions de freinage
    if (descLower.includes("frein") || descLower.includes("plaquette") || descLower.includes("disque")) {
      const relatedBrake = laborLines.filter((l, idx) => 
        !processed.has(idx) &&
        (l.description.toLowerCase().includes("frein") ||
         l.description.toLowerCase().includes("plaquette") ||
         l.description.toLowerCase().includes("disque")) &&
        l.quantity <= 0.5 &&
        l !== current
      );
      if (relatedBrake.length > 0) {
        related.push(...relatedBrake);
        relatedBrake.forEach(l => {
          const idx = laborLines.indexOf(l);
          if (idx !== -1) processed.add(idx);
        });
      }
    }
    
    // Si plusieurs interventions liées, fusionner
    if (related.length > 1) {
      let totalQty = related.reduce((sum, l) => sum + l.quantity, 0);
      const totalPrice = related.reduce((sum, l) => sum + (l.quantity * l.unit_price_ht), 0);
      
      // Construire une description regroupée propre
      let mergedDesc = "";
      const hasVidange = related.some(l => l.description.toLowerCase().includes("vidange"));
      const hasFiltre = related.some(l => l.description.toLowerCase().includes("filtre"));
      const hasFrein = related.some(l => l.description.toLowerCase().includes("frein") || l.description.toLowerCase().includes("plaquette"));
      
      if (hasVidange && hasFiltre) {
        // S'assurer que le temps combiné est logique (0.75h pour vidange + filtre)
        mergedDesc = "Vidange moteur + remplacement filtre";
        // Ajuster la quantité si nécessaire (minimum 0.75h pour vidange + filtre)
        if (totalQty < 0.75) {
          totalQty = 0.75;
        }
      } else if (hasFrein) {
        // Trouver la pièce de freinage associée
        const brakePiece = pieces.find(p => /plaquette|disque/i.test(p.description));
        if (brakePiece) {
          const pieceDescLower = brakePiece.description.toLowerCase();
          const position = pieceDescLower.includes("avant") ? "avant" : pieceDescLower.includes("arrière") ? "arrière" : "avant";
          mergedDesc = `Remplacement plaquettes de frein ${position}`;
        } else {
          mergedDesc = "Remplacement plaquettes avant";
        }
      } else {
        // Garder la description principale
        mergedDesc = current.description;
      }
      
      // Arrondir la quantité à 0.05h près
      const roundedQty = Math.round(totalQty * 20) / 20;
      
      groupedLabor.push({
        ...current,
        quantity: roundedQty,
        unit_price_ht: roundedQty > 0 ? Math.round((totalPrice / roundedQty) * 100) / 100 : current.unit_price_ht,
        description: mergedDesc,
      });
    } else {
      groupedLabor.push(current);
    }
  }
  
  // Ajouter les lignes non traitées
  for (let i = 0; i < laborLines.length; i++) {
    if (!processed.has(i)) {
      groupedLabor.push(laborLines[i]);
    }
  }
  
  // Réorganiser : pièces → main-d'œuvre → forfait → options → inclus
  return [
    ...pieces,
    ...groupedLabor,
    ...otherLines.filter(l => l.type === "forfait"),
    ...otherLines.filter(l => l.isOption),
    ...otherLines.filter(l => l.isIncluded),
  ];
}

/**
 * Limite le nombre de lignes par section (3 pièces max, 2 MO max pour interventions simples).
 */
function limitLinesPerSection(lines: AiQuoteLine[]): AiQuoteLine[] {
  // Détecter si c'est une intervention simple (freinage/vidange/pneus/batterie)
  const allDescriptions = lines.map(l => l.description.toLowerCase()).join(" ");
  const isSimpleIntervention = 
    /(frein|plaquette|disque|vidange|huile|pneu|batterie)/.test(allDescriptions) &&
    lines.length <= 15; // Si trop de lignes, ce n'est pas simple
    
  if (!isSimpleIntervention) return lines;
  
  const pieces = lines.filter(l => l.type === "piece" && !l.isOption);
  const labor = lines.filter(l => l.type === "main_oeuvre" && !l.isOption && !l.isIncluded);
  const options = lines.filter(l => l.isOption);
  const forfaits = lines.filter(l => l.type === "forfait" && !l.isOption);
  const included = lines.filter(l => l.isIncluded);
  
  let result: AiQuoteLine[] = [];
  
  // Limiter pièces à 3 max
  if (pieces.length > 3) {
    // Trier par prix décroissant et garder les 3 plus importantes
    const sortedPieces = [...pieces].sort((a, b) => 
      (b.quantity * b.unit_price_ht) - (a.quantity * a.unit_price_ht)
    );
    result.push(...sortedPieces.slice(0, 3));
    
    // Regrouper les autres en une ligne "Autres pièces"
    const remaining = sortedPieces.slice(3);
    if (remaining.length > 0) {
      const totalQty = remaining.reduce((sum, l) => sum + l.quantity, 0);
      const totalPrice = remaining.reduce((sum, l) => sum + (l.quantity * l.unit_price_ht), 0);
      result.push({
        type: "piece",
        description: `Autres pièces et consommables`,
        quantity: totalQty,
        unit: "unite",
        unit_price_ht: totalQty > 0 ? Math.round((totalPrice / totalQty) * 100) / 100 : 0,
        isOption: false,
        isIncluded: false,
      });
    }
  } else {
    result.push(...pieces);
  }
  
  // Limiter main-d'œuvre à 2 max
  if (labor.length > 2) {
    // Trier par quantité décroissante et garder les 2 plus importantes
    const sortedLabor = [...labor].sort((a, b) => b.quantity - a.quantity);
    const mainLabor = sortedLabor.slice(0, 2);
    const remaining = sortedLabor.slice(2);
    
    // Fusionner les lignes restantes avec la première ligne principale
    if (remaining.length > 0 && mainLabor.length > 0) {
      const first = mainLabor[0];
      const totalQty = first.quantity + remaining.reduce((sum, l) => sum + l.quantity, 0);
      const totalPrice = (first.quantity * first.unit_price_ht) + 
                        remaining.reduce((sum, l) => sum + (l.quantity * l.unit_price_ht), 0);
      
      mainLabor[0] = {
        ...first,
        quantity: totalQty,
        unit_price_ht: totalQty > 0 ? Math.round((totalPrice / totalQty) * 100) / 100 : first.unit_price_ht,
        description: `${first.description} + autres opérations`,
      };
    }
    
    result.push(...mainLabor);
  } else {
    result.push(...labor);
  }
  
  // Ajouter options, forfaits et inclus (sans limite)
  result.push(...options);
  result.push(...forfaits);
  result.push(...included);
  
  return result;
}

/**
 * Fonction principale de post-traitement premium.
 * 
 * @param lines - Lignes générées par l'IA (format LineSchema)
 * @returns Lignes post-traitées (même format, compatible)
 */
export function postProcessQuoteItems(lines: AiQuoteLine[]): AiQuoteLine[] {
  if (!lines || lines.length === 0) return lines;
  
  try {
    // 1. Corriger les descriptions tronquées (PREMIER traitement pour nettoyer dès le début)
    let processed = fixTruncatedDescriptions(lines);
    
    // Filtrer les lignes invalides après correction
    processed = processed.filter(line => {
      const desc = line.description.trim();
      // Supprimer les lignes avec description vide ou invalide
      if (!desc || desc.length === 0) return false;
      // Supprimer les lignes qui ne sont que des nombres ou durées
      if (/^\d+\.?\d*\s*h$/i.test(desc) || /^\d+\.?\d*$/.test(desc)) return false;
      return true;
    });
    
    // 2. Dé-doublonnage intelligent (déplacer plus tôt pour éviter de traiter des doublons)
    processed = deduplicateLines(processed);
    
    // 3. Validation cohérence mécanique (viscosités, pièces compatibles) - déplacer plus tôt
    processed = validateMechanicalConsistency(processed);
    
    // 4. Regroupement intelligent des interventions liées (vidange + filtre, etc.)
    processed = groupRelatedInterventions(processed);
    
    // 5. Regrouper les micro-lignes de main-d'œuvre
    processed = groupMicroLaborLines(processed);
    
    // 6. Regrouper les lignes incluses (0€)
    processed = groupIncludedLines(processed);
    
    // 7. Cohérence pièce / main-d'œuvre (même wording)
    processed = ensurePieceLaborConsistency(processed);
    
    // 8. Amélioration descriptions client-friendly
    processed = improveClientFriendlyDescriptions(processed);
    
    // 9. Suppression descriptions vagues restantes
    processed = improveVagueDescriptions(processed);
    
    // 9.5. Re-vérifier et corriger les descriptions tronquées après tous les traitements
    processed = fixTruncatedDescriptions(processed);
    
    // 10. Normalisation formatage
    processed = normalizeFormatting(processed);
    
    // 10.5. Dernière vérification des descriptions après formatage
    processed = processed.map(line => {
      const desc = line.description.trim();
      // Si description toujours tronquée après tous les traitements, utiliser fallback
      if (isTruncated(desc)) {
        return {
          ...line,
          description: getFallbackDescription(line.type, desc),
        };
      }
      return line;
    }).filter(line => {
      const desc = line.description.trim();
      // Filtrer les lignes invalides finales
      return desc && desc.length > 0 && !/^\d+\.?\d*\s*h$/i.test(desc) && !/^\d+\.?\d*$/.test(desc);
    });
    
    // 11. Amélioration descriptions options
    processed = improveOptionDescriptions(processed);
    
    // 12. Validation durées réalistes (vérifier 0h, arrondir à 0.05h)
    processed = validateRealisticDurations(processed);
    
    // 13. S'assurer que toutes les lignes ont des quantités valides (≥ 0.01 pour éviter les erreurs de validation)
    processed = processed.map(line => {
      if (line.quantity <= 0 && !line.isIncluded) {
        return { ...line, quantity: 0.01 }; // Quantité minimale pour les lignes payantes
      }
      if (line.quantity <= 0 && line.isIncluded) {
        return { ...line, quantity: 1 }; // Quantité minimale pour les lignes incluses
      }
      return line;
    });
    
    // 14. Limitation stricte lignes par section
    processed = limitLinesPerSection(processed);
    
    // 15. Regrouper intelligemment les huiles moteur (quantité > 1)
    processed = groupOilQuantities(processed);
    
    // 16. Enrichir forfait consommables si description trop vague
    processed = enrichConsumablesForfait(processed);
    
    // 17. Valider les totaux
    if (!validateTotals(lines, processed)) {
      console.warn("[postProcessQuoteItems] Totaux non préservés, retour des lignes originales");
      return lines; // Fallback : retourner les lignes originales
    }
    
    // 18. Dernière passe de nettoyage final pour garantir toutes les descriptions sont lisibles
    processed = processed
      .map(line => {
        const desc = line.description.trim();
        
        // Vérifier que la description est valide et complète
        if (!desc || desc.length === 0) {
          return null;
        }
        
        // Vérifier qu'elle n'est pas tronquée
        if (isTruncated(desc)) {
          const corrected = getFallbackDescription(line.type, desc);
          return {
            ...line,
            description: corrected,
          };
        }
        
        return line;
      })
      .filter((line): line is AiQuoteLine => line !== null);
    
    return processed;
  } catch (error) {
    console.error("[postProcessQuoteItems] Erreur lors du post-traitement:", error);
    return lines; // Fallback : retourner les lignes originales en cas d'erreur
  }
}
