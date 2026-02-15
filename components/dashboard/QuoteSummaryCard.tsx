"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Car } from "lucide-react";
import type { DevisLine } from "@/components/dashboard/DevisLineEditor";

interface QuoteSummaryCardProps {
  lines: DevisLine[];
}

/** Calcule la durée totale estimée en heures depuis les lignes de main-d'œuvre */
function calculateTotalDuration(lines: DevisLine[]): number {
  return lines
    .filter((l) => l.type === "labor")
    .reduce((sum, l) => sum + (l.quantity ?? 0), 0);
}

/** Formate la durée en format lisible */
function formatDuration(hours: number): string {
  if (hours === 0) return "—";
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

/** Extrait les principales interventions depuis les descriptions */
function extractMainInterventions(lines: DevisLine[]): string[] {
  const interventions: string[] = [];
  const seen = new Set<string>();
  
  lines.forEach((line) => {
    if (!line.description?.trim() || line.unit_price === 0) return;
    
    const desc = line.description.trim();
    // Extraire les mots-clés principaux (premiers mots de la description)
    const keywords = desc.split(/[,\-–]/)[0].trim();
    if (keywords && keywords.length > 3 && !seen.has(keywords.toLowerCase())) {
      seen.add(keywords.toLowerCase());
      if (interventions.length < 5) {
        interventions.push(keywords);
      }
    }
  });
  
  return interventions.slice(0, 4);
}

export function QuoteSummaryCard({ lines }: QuoteSummaryCardProps) {
  const totalDuration = calculateTotalDuration(lines);
  const interventions = extractMainInterventions(lines);
  
  // Déterminer l'immobilisation selon la durée
  const immobilisation = totalDuration <= 1 ? "1-2 heures" : totalDuration <= 3 ? "Demi-journée" : "Journée complète";

  // Ne pas afficher si aucune ligne
  if (lines.length === 0) return null;

  return (
    <Card className="rounded-[20px] border border-border/50 bg-card/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-250 ease-out">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold text-foreground mb-5">
          Résumé de l&apos;intervention
        </h3>
        
        <div className="space-y-4">
          {/* Liste des interventions principales */}
          {interventions.length > 0 && (
            <div className="space-y-2.5">
              {interventions.map((intervention, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-sm text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  <span className="font-medium">{intervention}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Informations de durée et immobilisation */}
          <div className="flex flex-wrap gap-6 pt-3 border-t border-border">
            {totalDuration > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Durée estimée :</span>{" "}
                  {formatDuration(totalDuration)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Car className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">Immobilisation :</span>{" "}
                {immobilisation}
              </span>
            </div>
          </div>
          
          {/* Message rassurant */}
          <div className="pt-2">
            <p className="text-xs text-muted-foreground italic">
              Devis détaillé, modifiable avant validation
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
