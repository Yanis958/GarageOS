"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import type { TooltipProps } from "recharts";
import { getQuoteActivityForChart, type QuoteActivityPoint, type QuoteActivityRange } from "@/lib/actions/quotes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS: { value: QuoteActivityRange; label: string }[] = [
  { value: "week", label: "Semaine (7 jours)" },
  { value: "30days", label: "30 derniers jours" },
  { value: "current_month", label: "Mois en cours" },
  { value: "year", label: "Année" },
];

const COLORS = {
  draft: "hsl(var(--muted-foreground))",
  sent: "hsl(var(--warning))",
  accepted: "hsl(var(--success))",
  other: "hsl(var(--destructive))",
};

type ChartMode = "volume" | "amount" | "conversion";

const STATUS_KEYS = ["draft", "sent", "accepted", "other"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  other: "Refusé/Annulé",
};

function formatEuro(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getValue(point: QuoteActivityPoint, key: (typeof STATUS_KEYS)[number], mode: ChartMode): number {
  if (mode === "volume") {
    return point[key];
  }
  if (mode === "conversion") {
    const total = point.draft + point.sent + point.accepted + point.other;
    return total > 0 ? (point[key] / total) * 100 : 0;
  }
  const ttcKey = `${key}_ttc` as keyof QuoteActivityPoint;
  return Number((point as Record<string, number>)[ttcKey]) || 0;
}

function getTotalForPoint(point: QuoteActivityPoint, mode: ChartMode): number {
  if (mode === "volume") return point.draft + point.sent + point.accepted + point.other;
  if (mode === "conversion") {
    const total = point.draft + point.sent + point.accepted + point.other;
    return total > 0 ? (point.accepted / total) * 100 : 0;
  }
  return (point.draft_ttc ?? 0) + (point.sent_ttc ?? 0) + (point.accepted_ttc ?? 0) + (point.other_ttc ?? 0);
}

function getTotalVolume(point: QuoteActivityPoint): number {
  return point.draft + point.sent + point.accepted + point.other;
}

function getTotalAmount(point: QuoteActivityPoint): number {
  return (point.draft_ttc ?? 0) + (point.sent_ttc ?? 0) + (point.accepted_ttc ?? 0) + (point.other_ttc ?? 0);
}

function getAcceptanceRate(point: QuoteActivityPoint): number {
  const total = getTotalVolume(point);
  return total > 0 ? (point.accepted / total) * 100 : 0;
}

const MAX_TOOLTIP_LINES = 5;

type CustomTooltipProps = TooltipProps<number, string> & {
  data: QuoteActivityPoint[];
  setActiveIndex: (i: number) => void;
  mode: ChartMode;
};

function CustomTooltip({ active, payload, label, data, setActiveIndex, mode }: CustomTooltipProps) {
  const dataRef = useRef(data);
  const lastIndexRef = useRef(-1);
  dataRef.current = data;

  useEffect(() => {
    if (active && payload?.length && payload[0].payload) {
      const point = payload[0].payload as QuoteActivityPoint;
      const idx = dataRef.current.findIndex((d) => d.label === point.label);
      const nextIndex = idx >= 0 ? idx : -1;
      if (nextIndex !== lastIndexRef.current) {
        lastIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
      }
    } else {
      if (lastIndexRef.current !== -1) {
        lastIndexRef.current = -1;
        setActiveIndex(-1);
      }
    }
  }, [active, payload, setActiveIndex]);

  if (!active || !payload?.length || !label) return null;

  const point = payload[0].payload as QuoteActivityPoint;
  const lines: { key: string; label: string; value: number; color: string }[] = [];
  STATUS_KEYS.forEach((key) => {
    const value = getValue(point, key, mode);
    if (value > 0) {
      lines.push({
        key,
        label: STATUS_LABELS[key] ?? key,
        value,
        color: COLORS[key],
      });
    }
  });

  const totalVolume = getTotalVolume(point);
  const totalAmount = getTotalAmount(point);
  const acceptanceRate = getAcceptanceRate(point);
  const total = getTotalForPoint(point, mode);
  const showTotal = total > 0 && lines.length > 0;
  const visibleLines = lines.slice(0, MAX_TOOLTIP_LINES - (showTotal ? 1 : 0));
  const hasMore = lines.length > visibleLines.length;

  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2.5 shadow-lg backdrop-blur-sm"
      style={{
        boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
      }}
    >
      <p className="mb-2 text-xs font-medium text-muted-foreground">{label}</p>
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun devis ce jour-là</p>
      ) : (
        <>
          <div className="mb-2 space-y-0.5 border-b border-border pb-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total devis</span>
              <span className="font-semibold text-foreground">{totalVolume}</span>
            </div>
            {mode !== "conversion" && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Montant total</span>
                  <span className="font-semibold text-foreground tabular-nums">{formatEuro(totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Taux acceptation</span>
                  <span className="font-semibold text-success tabular-nums">{acceptanceRate.toFixed(0)}%</span>
                </div>
              </>
            )}
          </div>
          <ul className="space-y-1">
            {visibleLines.map(({ key, label: l, value, color }) => (
              <li key={key} className="flex items-center gap-2 text-sm">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-foreground">{l}</span>
                <span className="tabular-nums text-foreground">
                  {mode === "amount" ? formatEuro(value) : mode === "conversion" ? `${value.toFixed(0)}%` : value}
                </span>
              </li>
            ))}
            {hasMore && (
              <li className="text-xs text-muted-foreground">…</li>
            )}
            {showTotal && (
              <li className="mt-1 flex items-center gap-2 border-t border-border pt-1.5 text-sm font-medium">
                <span className="text-foreground">Total</span>
                <span className="tabular-nums text-foreground">
                  {mode === "amount" ? formatEuro(total) : mode === "conversion" ? `${total.toFixed(0)}%` : total}
                </span>
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

export function ActivityChartCard() {
  const [period, setPeriod] = useState<QuoteActivityRange>("week");
  const [mode, setMode] = useState<ChartMode>("volume");
  const [data, setData] = useState<QuoteActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    setLoading(true);
    getQuoteActivityForChart(period)
      .then(setData)
      .finally(() => setLoading(false));
  }, [period]);

  const total = data.reduce(
    (acc, p) => acc + getTotalForPoint(p, mode),
    0
  );

  const periodLabel = PERIODS.find((p) => p.value === period)?.label ?? "Semaine (7 jours)";

  const dataWithDisplay = data.map((p) => {
    if (mode === "conversion") {
      const total = getTotalVolume(p);
      return {
        ...p,
        draftDisplay: total > 0 ? (p.draft / total) * 100 : 0,
        sentDisplay: total > 0 ? (p.sent / total) * 100 : 0,
        acceptedDisplay: total > 0 ? (p.accepted / total) * 100 : 0,
        otherDisplay: total > 0 ? (p.other / total) * 100 : 0,
      };
    }
    return {
      ...p,
      draftDisplay: getValue(p, "draft", mode),
      sentDisplay: getValue(p, "sent", mode),
      acceptedDisplay: getValue(p, "accepted", mode),
      otherDisplay: getValue(p, "other", mode),
    };
  });

  const yAxisTickFormatter = useCallback(
    (value: number) => {
      if (mode === "amount") return formatEuro(value);
      if (mode === "conversion") return `${value.toFixed(0)}%`;
      return String(value);
    },
    [mode]
  );

  const OBJECTIVE_DAILY_QUOTES = 3;

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-[180px] justify-between">
              {periodLabel}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {PERIODS.map((p) => (
              <DropdownMenuItem key={p.value} onClick={() => setPeriod(p.value)}>
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setMode("volume")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mode === "volume"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Volume
          </button>
          <button
            type="button"
            onClick={() => setMode("amount")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mode === "amount"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Montant
          </button>
          <button
            type="button"
            onClick={() => setMode("conversion")}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              mode === "conversion"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            Conversion %
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg bg-muted/20">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      ) : total === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-lg bg-muted/20">
          <p className="text-sm text-muted-foreground">Aucun devis sur la période.</p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dataWithDisplay}
              margin={{ top: 12, right: 12, left: 8, bottom: 8 }}
              barCategoryGap="14%"
              onMouseLeave={() => setActiveIndex(-1)}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border) / 0.6)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                allowDecimals={mode === "conversion"}
                domain={mode === "conversion" ? [0, 100] : [0, "auto"]}
                axisLine={false}
                tickLine={false}
                tickFormatter={yAxisTickFormatter}
              />
              {mode === "volume" && (
                <ReferenceLine
                  y={OBJECTIVE_DAILY_QUOTES}
                  stroke="hsl(var(--muted-foreground) / 0.4)"
                  strokeDasharray="3 3"
                  label={{ value: `Objectif ${OBJECTIVE_DAILY_QUOTES}/jour`, position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground) / 0.7)" }}
                />
              )}
              <Tooltip
                content={
                  <CustomTooltip
                    data={dataWithDisplay}
                    setActiveIndex={setActiveIndex}
                    mode={mode}
                  />
                }
                cursor={false}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, marginTop: 10 }}
                formatter={(name) => STATUS_LABELS[name] ?? name}
              />
              <Bar dataKey="draftDisplay" stackId="a" fill={COLORS.draft} name="draft">
                {dataWithDisplay.map((_, index) => (
                  <Cell
                    key={index}
                    opacity={activeIndex < 0 || index === activeIndex ? 1 : 0.35}
                    style={
                      index === activeIndex
                        ? { filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.4))" }
                        : undefined
                    }
                  />
                ))}
              </Bar>
              <Bar dataKey="sentDisplay" stackId="a" fill={COLORS.sent} name="sent">
                {dataWithDisplay.map((_, index) => (
                  <Cell
                    key={index}
                    opacity={activeIndex < 0 || index === activeIndex ? 1 : 0.35}
                    style={
                      index === activeIndex
                        ? { filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.4))" }
                        : undefined
                    }
                  />
                ))}
              </Bar>
              <Bar dataKey="acceptedDisplay" stackId="a" fill={COLORS.accepted} name="accepted">
                {dataWithDisplay.map((_, index) => (
                  <Cell
                    key={index}
                    opacity={activeIndex < 0 || index === activeIndex ? 1 : 0.35}
                    style={
                      index === activeIndex
                        ? { filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.4))" }
                        : undefined
                    }
                  />
                ))}
              </Bar>
              <Bar dataKey="otherDisplay" stackId="a" fill={COLORS.other} name="other">
                {dataWithDisplay.map((_, index) => (
                  <Cell
                    key={index}
                    opacity={activeIndex < 0 || index === activeIndex ? 1 : 0.35}
                    style={
                      index === activeIndex
                        ? { filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.4))" }
                        : undefined
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
