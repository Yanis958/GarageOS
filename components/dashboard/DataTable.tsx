import { ReactNode } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { DataTableRow } from "./DataTableRow";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface DataTableProps<T> {
  title: string;
  columns: DataTableColumn<T>[];
  data: T[];
  emptyState?: {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: { label: string; href: string };
  };
  searchPlaceholder?: string;
  searchValue?: string;
  searchAction?: string;
  searchName?: string;
  filters?: ReactNode;
  rowActions?: (row: T) => ReactNode;
  rowHref?: (row: T) => string;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  title,
  columns,
  data,
  emptyState,
  searchPlaceholder = "Rechercher...",
  searchValue,
  searchAction,
  searchName = "q",
  filters,
  rowActions,
  rowHref,
  className,
}: DataTableProps<T>) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b border-border">
        <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Search & Filters */}
        {(searchValue !== undefined || filters) && (
          <div className="border-b border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-3">
              {searchValue !== undefined && searchAction && (
                <form method="get" action={searchAction} className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      name={searchName}
                      placeholder={searchPlaceholder}
                      defaultValue={searchValue}
                      className="rounded-input border-border bg-background pl-9 pr-4 py-2 text-sm focus-visible:ring-primary/40"
                    />
                  </div>
                </form>
              )}
              {filters}
            </div>
          </div>
        )}

        {/* Table */}
        {data.length === 0 ? (
          <div className="p-8">
            {emptyState ? (
              <EmptyState
                icon={emptyState.icon}
                title={emptyState.title}
                description={emptyState.description}
                action={emptyState.action}
              />
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                Aucun résultat
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                        col.className
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {col.header}
                        {col.sortable && (
                          <button className="text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {rowActions && (
                    <th className="w-24 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row) => {
                  const href = rowHref?.(row);
                  // Appeler col.render(row) dans le Server Component pour obtenir des ReactNode
                  const renderedCells = columns.map((col) => col.render(row));
                  const columnClassNames = columns.map((col) => col.className);
                  const actions = rowActions?.(row);

                  return (
                    <DataTableRow
                      key={row.id}
                      cells={renderedCells}
                      href={href}
                      rowActions={actions}
                      columnClassNames={columnClassNames}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
