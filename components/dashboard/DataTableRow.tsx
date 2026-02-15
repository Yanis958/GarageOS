"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DataTableRowProps {
  cells: ReactNode[];
  href?: string;
  rowActions?: ReactNode;
  columnClassNames?: string[];
}

export function DataTableRow({ cells, href, rowActions, columnClassNames }: DataTableRowProps) {
  const router = useRouter();

  return (
    <tr
      onClick={href ? (e) => {
        // Ne pas naviguer si on clique sur un bouton, lien ou élément interactif
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('[role="button"]')) {
          return;
        }
        router.push(href);
      } : undefined}
      className={cn(
        "group transition-all duration-200",
        href ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/50"
      )}
    >
      {cells.map((cell, i) => (
        <td
          key={i}
          className={cn("px-4 py-3", columnClassNames?.[i])}
        >
          {href ? (
            <div className="flex items-center gap-2">
              {cell}
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all duration-200" />
            </div>
          ) : (
            cell
          )}
        </td>
      ))}
      {rowActions && (
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {rowActions}
          </div>
        </td>
      )}
    </tr>
  );
}
