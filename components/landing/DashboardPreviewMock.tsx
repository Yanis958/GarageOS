import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardPreviewMock() {
  return (
    <Card className="overflow-hidden border-primary/20 bg-card/80 shadow-xl shadow-primary/5 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex gap-2">
          <div className="h-16 flex-1 rounded-lg bg-muted/60 animate-pulse" />
          <div className="h-16 flex-1 rounded-lg bg-muted/60 animate-pulse" />
        </div>
        <div className="h-24 w-full rounded-lg bg-muted/40 animate-pulse" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted/50 animate-pulse" />
          <div className="h-3 w-[85%] rounded bg-muted/50 animate-pulse" />
          <div className="h-3 w-[60%] rounded bg-muted/50 animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}
