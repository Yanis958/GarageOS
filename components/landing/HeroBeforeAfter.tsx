"use client";

import { useState, useEffect } from "react";
import { FileText, Zap } from "lucide-react";

export function HeroBeforeAfter() {
  const [count, setCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const duration = 1500;
    const steps = 30;
    const stepDuration = duration / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += 1;
      setCount(Math.min(current, 30));
      if (current >= 30) clearInterval(timer);
    }, stepDuration);
    return () => clearInterval(timer);
  }, [mounted]);

  return (
    <div
      className={`w-full rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6 sm:p-8 transition-opacity duration-700 ${mounted ? "opacity-100" : "opacity-0"}`}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 sm:gap-4 items-stretch min-h-[200px]">
        {/* AVANT */}
        <div className="flex flex-col rounded-xl bg-slate-800/60 border border-slate-700/80 p-4">
          <span className="text-xs font-medium text-slate-400 mb-3">Avant GARAGE OS</span>
          <div className="flex-1 flex flex-col justify-center gap-2">
            <div className="relative h-12 flex items-center justify-center opacity-80">
              <FileText className="absolute h-6 w-6 text-slate-500 rotate-[-12deg] left-2 top-1" />
              <FileText className="absolute h-5 w-5 text-slate-500 rotate-[6deg] left-5 top-3" />
              <FileText className="absolute h-6 w-6 text-slate-500 rotate-[-5deg] left-8 top-0" />
              <FileText className="absolute h-5 w-5 text-slate-500 rotate-[10deg] right-4 top-2" />
            </div>
            <p className="text-xs text-slate-500 mt-1">Excel · Post-its</p>
            <p className="text-sm font-semibold text-red-400 mt-2">2h par jour en saisie</p>
          </div>
        </div>

        {/* FLÈCHE */}
        <div className="flex items-center justify-center px-1">
          <span className="text-2xl sm:text-3xl text-primary animate-pulse" aria-hidden>→</span>
        </div>

        {/* APRÈS */}
        <div className="flex flex-col rounded-xl bg-slate-800/60 border border-slate-700/80 p-4">
          <span className="text-xs font-medium text-purple-400 mb-3">Avec GARAGE OS</span>
          <div className="flex-1 flex flex-col justify-center gap-1 items-center text-center">
            <Zap className="h-10 w-10 sm:h-12 sm:w-12 text-amber-400 mb-1" />
            <span className="text-2xl sm:text-3xl font-bold tabular-nums text-emerald-400">
              {count}s
            </span>
            <p className="text-xs text-slate-400">par devis avec l&apos;IA</p>
            <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
              ✓ Automatique
            </span>
          </div>
        </div>
      </div>

      {/* STATS EN BAS */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs border border-slate-700">
          📊 -70% de temps admin
        </span>
        <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs border border-slate-700">
          ✓ 100% données sécurisées
        </span>
        <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-xs border border-slate-700">
          🚀 Multi-garages
        </span>
      </div>
    </div>
  );
}
