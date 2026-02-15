import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { createClientAction } from "@/lib/actions/clients";
import { ClientForm } from "./ClientForm";

export default function NewClientPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux clients
      </Link>
      <Card className="border-l-4 border-l-primary border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Nouveau client</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientForm action={createClientAction} />
        </CardContent>
      </Card>
    </div>
  );
}
