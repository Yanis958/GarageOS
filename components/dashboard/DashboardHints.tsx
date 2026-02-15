"use client";

import { AlertCircle, Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type DashboardHint = {
  type: "info" | "warning";
  message: string;
  href?: string;
};

export function DashboardHints({ hints }: { hints: DashboardHint[] }) {
  if (hints.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {hints.slice(0, 2).map((hint, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed",
            hint.type === "warning"
              ? "border-warning/30 bg-warning/5 text-warning-foreground"
              : "border-border/50 bg-muted/30 text-muted-foreground"
          )}
        >
          {hint.type === "warning" ? (
            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          ) : (
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
          )}
          <span className="flex-1">
            {hint.href ? (
              <Link href={hint.href} className="hover:underline font-medium">
                {hint.message}
              </Link>
            ) : (
              hint.message
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
