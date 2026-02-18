import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Mail } from "lucide-react";

export default function TrialExpirePage() {
  const contactEmail = "contact@garageos.fr"; // À adapter selon votre email de contact

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full border-border shadow-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-orange-500/10 p-3">
              <AlertCircle className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <CardTitle className="text-2xl text-foreground">
            Votre essai gratuit est terminé
          </CardTitle>
          <CardDescription className="mt-2">
            Pour continuer à utiliser GarageOS, vous devez activer votre licence.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Contactez-nous pour activer votre licence et continuer à bénéficier de toutes les fonctionnalités de GarageOS.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <Mail className="h-4 w-4" />
              <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                {contactEmail}
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="w-full bg-primary text-primary-foreground">
              <a href={`mailto:${contactEmail}?subject=Activation de licence GarageOS`}>
                Nous contacter
              </a>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Retour à la connexion</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
