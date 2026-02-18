import { redirect } from "next/navigation";
import { getInvitationByToken } from "@/lib/actions/invitations";
import { InvitationSignupForm } from "./InvitationSignupForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full border-border shadow-sm">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-center text-foreground">
              Lien d'invitation invalide
            </CardTitle>
            <CardDescription className="text-center">
              Ce lien d'invitation n'existe pas ou a été supprimé.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (invitation.used) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full border-border shadow-sm">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-orange-500/10 p-3">
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </div>
            <CardTitle className="text-center text-foreground">
              Ce lien a déjà été utilisé
            </CardTitle>
            <CardDescription className="text-center">
              Cette invitation a déjà été utilisée le {invitation.used_at ? new Date(invitation.used_at).toLocaleDateString("fr-FR") : ""}.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Créer votre compte GarageOS
          </h1>
          <p className="text-sm text-muted-foreground">
            Vous avez été invité à créer le garage : <strong className="text-foreground">{invitation.garage_name}</strong>
          </p>
        </div>
        <InvitationSignupForm invitationToken={token} garageName={invitation.garage_name} />
      </div>
    </div>
  );
}
