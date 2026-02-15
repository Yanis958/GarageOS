import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "@/lib/actions/garage";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const garageId = await getCurrentGarageId();
  if (garageId) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Créer mon garage
          </h1>
          <p className="text-sm text-muted-foreground">
            Vous n&apos;êtes pas encore rattaché à un garage. Créez le vôtre pour commencer.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
