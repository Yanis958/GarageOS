"use client";

import { useState, useRef, useEffect } from "react";
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Copy, Sparkles, Info, Wrench, Clock, Package, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

export type LineType = "labor" | "part" | "forfait";

export type DevisLine = {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  type?: LineType;
  isAiGenerated?: boolean;
  optional?: boolean;
  optional_reason?: string;
  estimated_range?: string;
  pricing_note?: string;
  cost_price_ht?: number;
  margin_ht?: number;
};

const LINE_TYPE_LABELS: Record<LineType, string> = {
  labor: "Main-d'œuvre",
  part: "Pièce",
  forfait: "Forfait",
};

/** Retourne l'icône appropriée pour un type de ligne */
function getLineTypeIcon(type: LineType) {
  switch (type) {
    case "part":
      return Wrench;
    case "labor":
      return Clock;
    case "forfait":
      return Package;
    default:
      return Wrench;
  }
}

const DEFAULT_LINE: Omit<DevisLine, "id"> = {
  description: "",
  quantity: 1,
  unit_price: 0,
  total: 0,
  type: "part",
};

/** Calcule le total HT selon le type de ligne (recalcul temps réel). */
function computeLineTotalForType(type: LineType, qty: number, unitPrice: number): number {
  if (type === "forfait") return Math.round(unitPrice * 100) / 100;
  return Math.round(qty * unitPrice * 100) / 100;
}

function parseQuantity(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function parseUnitPrice(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Convertit un nombre d'heures en format lisible (ex: 0.5 → "30 min", 1.5 → "1h30") */
function formatDurationReadable(hours: number): string {
  if (hours === 0 || !Number.isFinite(hours)) return "";
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  
  if (wholeHours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return wholeHours === 1 ? "1 heure" : `${wholeHours} heures`;
  }
  return `${wholeHours}h${minutes.toString().padStart(2, "0")}`;
}

/** Convertit les heures en minutes pour affichage */
function hoursToMinutes(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  return Math.round(hours * 60);
}

/** Normalise les lignes de manière déterministe (identique serveur/client) */
function normalizeLines(initialLines: DevisLine[]): DevisLine[] {
  if (initialLines.length === 0) return [];
  
  return initialLines
    .filter((l) => {
      // Filtrer les lignes vraiment vides (pas de description ET prix à 0)
      const hasContent = (l.description?.trim() || "").length > 0 || (l.unit_price ?? 0) > 0 || (l.quantity ?? 0) > 0;
      return hasContent;
    })
    .map((l) => {
      const type = (l.type === "labor" || l.type === "part" || l.type === "forfait" ? l.type : "part") as LineType;
      const qty = type === "forfait" ? 1 : (Number(l.quantity) ?? 0);
      const up = Number(l.unit_price) ?? 0;
      return {
        ...l,
        quantity: qty,
        unit_price: up,
        total: computeLineTotalForType(type, qty, up),
        type,
        // Préserver les nouveaux champs
        optional: l.optional,
        optional_reason: l.optional_reason,
        estimated_range: l.estimated_range,
        pricing_note: l.pricing_note,
        cost_price_ht: l.cost_price_ht,
        margin_ht: l.margin_ht,
        isAiGenerated: l.isAiGenerated,
      };
    });
}

/** Regroupe les lignes par type pour affichage avec séparateurs et sous-totaux */
function groupLinesByType(
  lines: DevisLine[],
  optionalEnabled: Record<string, boolean>
): Array<{ 
  type: LineType; 
  label: string; 
  lines: DevisLine[];
  subtotal: number;
  icon: typeof Wrench | typeof Clock | typeof Package;
}> {
  const groups: Array<{ 
    type: LineType; 
    label: string; 
    lines: DevisLine[];
    subtotal: number;
    icon: typeof Wrench | typeof Clock | typeof Package;
  }> = [];
  const typeOrder: LineType[] = ["part", "labor", "forfait"];
  
  typeOrder.forEach((type) => {
    const typeLines = lines.filter((l) => (l.type ?? "part") === type);
    if (typeLines.length > 0) {
      // Calculer le sous-total en excluant les lignes optionnelles désactivées
      const subtotal = typeLines.reduce((sum, l) => {
        if (l.optional && !(optionalEnabled[l.id] ?? true)) return sum;
        return sum + l.total;
      }, 0);
      
      groups.push({
        type,
        label: LINE_TYPE_LABELS[type],
        lines: typeLines,
        subtotal,
        icon: getLineTypeIcon(type),
      });
    }
  });
  
  return groups;
}

export function DevisLineEditor({
  lines: initialLines,
  onChange,
  readOnly = false,
  confirmBeforeRemove = false,
  vatRateDecimal = 0.2,
}: {
  lines: DevisLine[];
  onChange: (lines: DevisLine[], totalHt: number, totalTtc: number) => void;
  readOnly?: boolean;
  confirmBeforeRemove?: boolean;
  /** Taux de TVA en décimal (ex. 0.2 pour 20 %), depuis garage_settings */
  vatRateDecimal?: number;
}) {
  // Initialiser les lignes directement avec normalizeLines pour éviter les erreurs d'hydratation
  const [lines, setLines] = useState<DevisLine[]>(() => normalizeLines(initialLines));
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const descriptionRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const prevInitialLinesRef = useRef<string>("");
  // État pour gérer les lignes optionnelles activées/désactivées
  const [optionalEnabled, setOptionalEnabled] = useState<Record<string, boolean>>({});
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Initialiser l'état des lignes optionnelles (toutes activées par défaut)
  useEffect(() => {
    const enabled: Record<string, boolean> = {};
    initialLines.forEach((l) => {
      if (l.optional) {
        enabled[l.id] = optionalEnabled[l.id] ?? true; // Conserver l'état existant ou activer par défaut
      }
    });
    setOptionalEnabled((prev) => ({ ...prev, ...enabled }));
  }, [initialLines.map((l) => l.id).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Synchroniser l'état local avec les props quand elles changent (ex: lignes générées par IA)
  useEffect(() => {
    // Créer une clé de comparaison basée sur les IDs et la longueur
    const currentKey = initialLines.map((l) => l.id).join(",") + `|${initialLines.length}`;
    
    // Si les lignes n'ont pas changé, ne rien faire
    if (currentKey === prevInitialLinesRef.current) {
      return;
    }
    
    prevInitialLinesRef.current = currentKey;
    
    // Normaliser les lignes de manière stable
    const normalized = normalizeLines(initialLines);
    
    // Mettre à jour seulement si différent pour éviter les re-renders
    setLines((prev) => {
      const prevKey = prev.map((p) => p.id).join(",") + `|${prev.length}`;
      if (prevKey !== currentKey) {
        return normalized;
      }
      return prev;
    });
    
    // Recalculer les totaux en tenant compte des options désactivées
    const ht = normalized.reduce((s, l) => {
      if (l.optional && !optionalEnabled[l.id]) return s;
      return s + l.total;
    }, 0);
    const tva = Math.round(ht * vatRateDecimal * 100) / 100;
    const ttc = Math.round((ht + tva) * 100) / 100;
    onChange(normalized, ht, ttc);
  }, [initialLines, onChange, optionalEnabled, vatRateDecimal]);

  useEffect(() => {
    if (lastAddedId && descriptionRefs.current[lastAddedId]) {
      descriptionRefs.current[lastAddedId]?.focus();
      setLastAddedId(null);
    }
  }, [lastAddedId, lines]);

  // Auto-hide hint après première interaction - uniquement côté client
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMounted(true);
      const dismissed = localStorage.getItem("devis-hint-dismissed");
      if (dismissed === "true") {
        setHintDismissed(true);
      }
    }
  }, []);

  const handleDismissHint = () => {
    setHintDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("devis-hint-dismissed", "true");
    }
  };

  const updateLines = (next: DevisLine[]) => {
    setLines(next);
    const ht = next.reduce((s, l) => {
      if (l.optional && !optionalEnabled[l.id]) return s;
      return s + l.total;
    }, 0);
    const tva = Math.round(ht * vatRateDecimal * 100) / 100;
    const ttc = Math.round((ht + tva) * 100) / 100;
    onChange(next, ht, ttc);
  };

  const updateLine = (id: string, field: keyof DevisLine, value: string | number) => {
    const next = lines.map((l) => {
      if (l.id !== id) return l;
      const type = (l.type ?? "part") as LineType;
      const updated = { ...l, [field]: value };

      if (field === "type") {
        const newType = value as LineType;
        if (newType === "forfait") {
          updated.quantity = 1;
          updated.unit_price = l.unit_price;
          updated.total = computeLineTotalForType("forfait", 1, l.unit_price);
        } else {
          updated.quantity = l.quantity;
          updated.total = computeLineTotalForType(newType, updated.quantity, l.unit_price);
        }
      } else if (field === "quantity" || field === "unit_price") {
        const qty = type === "forfait" ? 1 : (field === "quantity" ? Number(value) : l.quantity);
        const up = field === "unit_price" ? Number(value) : l.unit_price;
        if (type === "forfait") updated.quantity = 1;
        updated.total = computeLineTotalForType(type, qty, up);
      }
      return updated;
    });
    updateLines(next);
  };

  const addLine = () => {
    const newId = crypto.randomUUID();
    setLastAddedId(newId);
    updateLines([...lines, { ...DEFAULT_LINE, id: newId }]);
  };

  const removeLine = (id: string) => {
    const next = lines.filter((l) => l.id !== id);
    // Ne pas créer de ligne vide automatiquement - l'utilisateur peut en ajouter une s'il veut
    updateLines(next);
  };

  const duplicateLine = (id: string) => {
    const idx = lines.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const copy = { ...lines[idx], id: crypto.randomUUID() };
    const next = [...lines];
    next.splice(idx + 1, 0, copy);
    setLastAddedId(copy.id);
    updateLines(next);
  };

  return (
    <div className="space-y-6">
      {/* En-tête explicatif discret */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-1">Lignes d&apos;intervention</h3>
          {!readOnly && (
            <p className="text-xs text-muted-foreground/60">
              Cliquez sur les champs pour modifier les prix, quantités et descriptions
            </p>
          )}
        </div>
        {!readOnly && (
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={addLine}
            className="rounded-[8px] border-border/50 text-foreground hover:bg-muted/50 transition-all duration-200"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter une ligne
          </Button>
        )}
      </div>

      <div className="w-full min-w-0 overflow-x-auto">
        <table className="w-full text-sm table-auto min-w-[920px]">
          <colgroup>
            <col style={{ width: "15%" }} />
            <col style={{ width: "auto", minWidth: "300px" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            {!readOnly && <col style={{ width: "6%" }} />}
          </colgroup>
          <thead>
            <tr className="border-b border-border/30">
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Type</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Description</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Qté / h</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Prix u. HT</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Total HT</th>
              {!readOnly && <th className="px-2 py-2 w-14" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {lines.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 5 : 6} className="px-2 py-6 text-center overflow-hidden min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Aucune ligne d&apos;intervention. {!readOnly && "Cliquez sur « Ajouter une ligne » pour commencer."}
                  </p>
                </td>
              </tr>
            ) : (
              groupLinesByType(lines, optionalEnabled).map((group, groupIndex) => {
              const GroupIcon = group.icon;
              const isLaborGroup = group.type === "labor";
              const isPartGroup = group.type === "part";
              const isForfaitGroup = group.type === "forfait";
              
              return (
              <React.Fragment key={group.type}>
                {/* Séparateur visuel fort entre sections */}
                {groupIndex > 0 && (
                  <tr>
                    <td colSpan={readOnly ? 5 : 6} className="px-2 py-1 overflow-hidden min-w-0">
                      <div className="h-px bg-border/50" />
                    </td>
                  </tr>
                )}
                {/* En-tête de section avec sous-total clair */}
                <tr className="bg-muted/20 border-t border-border/30">
                  <td colSpan={readOnly ? 5 : 6} className="px-2 py-2 overflow-hidden min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-y-1 gap-x-2">
                      <div className="flex items-center gap-2 min-w-0 shrink">
                        <GroupIcon className={`h-4 w-4 shrink-0 ${
                          isPartGroup ? "text-primary" : 
                          isLaborGroup ? "text-primary" : 
                          "text-secondary"
                        }`} />
                        <span className="text-sm font-semibold text-foreground uppercase tracking-wide whitespace-nowrap">
                          {group.label}
                        </span>
                        {isLaborGroup && group.lines.length > 0 && (
                          <span className="text-xs text-muted-foreground/60 font-normal shrink-0">
                            {group.lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0).toFixed(1)}h
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-primary tabular-nums shrink-0">
                        Sous-total {group.label.toLowerCase()} : {group.subtotal.toFixed(2)} €
                      </span>
                    </div>
                  </td>
                </tr>
                {group.lines.map((line, lineIndex) => {
              const lineType = (line.type ?? "part") as LineType;
              const TypeIcon = getLineTypeIcon(lineType);
              const isLabor = lineType === "labor";
              const isForfait = lineType === "forfait";
              const isOptionalDisabled = line.optional && !(optionalEnabled[line.id] ?? true);
              
              return (
              <tr 
                key={line.id}
                data-line-id={line.id}
                className={`relative min-h-[2.5rem] ${
                  isOptionalDisabled ? "opacity-50" : ""
                } ${
                  line.unit_price === 0 && line.isAiGenerated ? "opacity-90" : ""
                } ${
                  line.optional && (optionalEnabled[line.id] ?? true) ? "bg-primary/5 border-l-2 border-l-primary" : ""
                } ${
                  activeRowId === line.id ? "bg-muted/20" : ""
                } hover:bg-muted/10 transition-all duration-150 ease-out group`}
              >
                <td className="px-2 py-2 align-top overflow-hidden min-w-0">
                  <div className="flex items-center gap-2 min-w-0 max-w-full">
                    {line.optional && !readOnly && (
                      <input
                        type="checkbox"
                        checked={optionalEnabled[line.id] ?? true}
                        onChange={(e) => {
                          setOptionalEnabled((prev) => ({ ...prev, [line.id]: e.target.checked }));
                          // Recalculer les totaux immédiatement
                          const updatedLines = lines.map((l) => 
                            l.id === line.id ? l : l
                          );
                          const ht = updatedLines.reduce((s, l) => {
                            const isDisabled = l.optional && !(l.id === line.id ? e.target.checked : optionalEnabled[l.id] ?? true);
                            if (isDisabled) return s;
                            return s + l.total;
                          }, 0);
                          const tva = Math.round(ht * vatRateDecimal * 100) / 100;
                          const ttc = Math.round((ht + tva) * 100) / 100;
                          onChange(updatedLines, ht, ttc);
                        }}
                        className="h-4 w-4 rounded border-border text-quote focus:ring-2 focus:ring-quote focus:ring-offset-1 cursor-pointer shrink-0 transition-all duration-150"
                        title={optionalEnabled[line.id] ?? true ? "Désactiver cette option" : "Activer cette option"}
                      />
                    )}
                    <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    {readOnly ? (
                      <span className={`text-muted-foreground whitespace-nowrap ${line.optional && !(optionalEnabled[line.id] ?? true) ? "opacity-50" : ""}`}>
                        {LINE_TYPE_LABELS[lineType]}
                      </span>
                    ) : (
                      <select
                        value={lineType}
                        onChange={(e) => updateLine(line.id, "type", e.target.value as LineType)}
                        onFocus={() => setActiveRowId(line.id)}
                        onBlur={() => {
                          setTimeout(() => {
                            if (typeof document !== "undefined" && document.activeElement?.closest("tr") !== document.querySelector(`tr[data-line-id="${line.id}"]`)) {
                              setActiveRowId(null);
                            }
                          }, 100);
                        }}
                        className={`h-10 w-full min-w-0 rounded-[8px] border-0 bg-transparent text-sm focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background transition-all duration-250 ease-out hover:bg-muted/40 focus:bg-muted/40 focus:shadow-[0_0_0_3px_rgba(109,93,246,0.1)] cursor-pointer whitespace-nowrap ${
                          line.optional && !(optionalEnabled[line.id] ?? true) ? "opacity-50" : ""
                        }`}
                      >
                        {(Object.keys(LINE_TYPE_LABELS) as LineType[]).map((t) => (
                          <option key={t} value={t}>{LINE_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 align-top min-w-[300px]">
                  <div className="flex flex-col gap-1.5">
                    {/* Ligne 1 : description seule (pas de superposition avec les badges) */}
                    <div className="w-full">
                      <Tooltip content={line.description || "Désignation"}>
                        <Input
                          ref={(el) => { 
                            descriptionRefs.current[line.id] = el;
                          }}
                          value={line.description}
                          onChange={(e) => updateLine(line.id, "description", e.target.value)}
                          onFocus={() => setActiveRowId(line.id)}
                          onBlur={() => {
                            setTimeout(() => {
                              if (typeof document !== "undefined" && document.activeElement?.closest("tr") !== document.querySelector(`tr[data-line-id="${line.id}"]`)) {
                                setActiveRowId(null);
                              }
                            }, 100);
                            }}
                          placeholder="Désignation"
                          readOnly={readOnly}
                          className={`min-h-8 w-full border-0 bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-0 read-only:bg-transparent transition-all duration-200 text-sm leading-tight ${
                            isOptionalDisabled ? "opacity-50" : ""
                          } ${!readOnly ? "hover:bg-muted/20 focus:bg-muted/20" : ""}`}
                        />
                      </Tooltip>
                    </div>
                    {/* Ligne 2 : badges sous la description (jamais superposés) */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {line.isAiGenerated && (
                        <Tooltip content="Généré automatiquement">
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/15 text-secondary border border-secondary/20 cursor-help whitespace-nowrap">
                            <Sparkles className="h-2.5 w-2.5 shrink-0" />
                            IA
                          </span>
                        </Tooltip>
                      )}
                      {line.optional && (
                        <Tooltip content="Option recommandée, non obligatoire">
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium bg-warning/15 text-warning border border-warning/20 cursor-help whitespace-nowrap">
                            <Info className="h-2.5 w-2.5 shrink-0" />
                            Option
                          </span>
                        </Tooltip>
                      )}
                      {line.unit_price === 0 && line.isAiGenerated && (
                        <Tooltip content="Inclus sans coût supplémentaire">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-success/15 text-success border border-success/20 cursor-help whitespace-nowrap">
                            Inclus
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    {line.optional && !readOnly && (optionalEnabled[line.id] ?? true) && (
                      <p className="text-[11px] text-muted-foreground/70 leading-tight">
                        {line.optional_reason || "Option recommandée"}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-right align-top overflow-hidden min-w-0">
                  <div className="flex flex-col items-end gap-0.5 min-w-0 max-w-full">
                    {isForfait ? (
                      <span className="text-sm text-muted-foreground font-medium">1</span>
                    ) : (
                      <>
                        {/* Ligne 1 : input quantité + unité "h" bien espacés (pas de superposition) */}
                        <div className="flex items-center justify-end gap-2 w-full max-w-full min-w-0">
                          <Input
                            type="number"
                            min={0}
                            step={isLabor ? 0.1 : 1}
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, "quantity", parseQuantity(e.target.value))}
                            onFocus={() => setActiveRowId(line.id)}
                            onBlur={() => {
                              setTimeout(() => {
                                if (typeof document !== "undefined" && document.activeElement?.closest("tr") !== document.querySelector(`tr[data-line-id="${line.id}"]`)) {
                                  setActiveRowId(null);
                                }
                              }, 100);
                            }}
                            readOnly={readOnly}
                            className={`h-8 w-full max-w-[5.5rem] text-right border-0 bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 read-only:bg-transparent text-sm font-medium rounded transition-all shrink-0 ${
                              isLabor ? "text-foreground" : "text-muted-foreground"
                            } ${!readOnly ? "hover:bg-muted/40 focus:bg-muted/40" : ""}`}
                          />
                          {isLabor && <span className="text-sm font-medium text-foreground w-4 text-left shrink-0">h</span>}
                        </div>
                        {/* Ligne 2 : taux horaire sous le champ (main-d'œuvre uniquement) */}
                        {isLabor && line.unit_price > 0 && (
                          <span className="text-[11px] text-muted-foreground/70 leading-tight">
                            {line.unit_price.toFixed(0)} €/h
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-right align-top overflow-hidden min-w-0">
                  <div className="flex flex-col items-end gap-0.5 max-w-full min-w-0">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.unit_price}
                      onChange={(e) => updateLine(line.id, "unit_price", parseUnitPrice(e.target.value))}
                      onFocus={() => setActiveRowId(line.id)}
                      onBlur={() => {
                        setTimeout(() => {
                          if (typeof document !== "undefined" && document.activeElement?.closest("tr") !== document.querySelector(`tr[data-line-id="${line.id}"]`)) {
                            setActiveRowId(null);
                          }
                        }, 100);
                      }}
                      readOnly={readOnly}
                      placeholder={isForfait ? "Forfait" : "0"}
                      className={`h-8 w-full max-w-[4.5rem] text-right border-0 bg-transparent shadow-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 read-only:bg-transparent text-sm rounded transition-all shrink-0 ${
                        line.unit_price === 0 && line.isAiGenerated ? "text-muted-foreground" : ""
                      } ${isOptionalDisabled ? "opacity-50" : ""} ${!readOnly ? "hover:bg-muted/30 focus:bg-muted/30" : ""}`}
                    />
                  </div>
                </td>
                <td className={`px-2 py-2 text-right tabular-nums font-semibold text-sm align-top overflow-hidden min-w-0 ${
                  isOptionalDisabled ? "opacity-50 text-muted-foreground" : "text-primary"
                }`}>
                  {isOptionalDisabled ? "—" : `${line.total.toFixed(2)} €`}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2 align-top overflow-hidden min-w-0">
                    <div className={`flex items-center gap-1 transition-all duration-150 max-w-full ${
                      activeRowId === line.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    }`}>
                      <button
                        type="button"
                        onClick={() => duplicateLine(line.id)}
                        className="p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 rounded transition-all duration-150 cursor-pointer"
                        title="Dupliquer cette ligne"
                        aria-label="Dupliquer cette ligne"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirmBeforeRemove && !confirm("Supprimer la ligne ?\n\nCette action est irréversible.")) return;
                          removeLine(line.id);
                        }}
                        className="p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded transition-all duration-150 cursor-pointer"
                        title="Supprimer cette ligne"
                        aria-label="Supprimer cette ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
                );
              })}
              </React.Fragment>
            );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Micro-copy sous le tableau, hors zone scrollable pour éviter que la barre de défilement ne la recouvre */}
      {lines.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border/20">
          <p className="text-xs text-muted-foreground/60 text-center leading-relaxed">
            Les montants sont exprimés en euros.<br />
            {!readOnly && "Les lignes restent modifiables jusqu'à validation du devis."}
          </p>
        </div>
      )}
    </div>
  );
}
