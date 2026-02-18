/**
 * Layout pour la page trial-expire
 * Cette page est accessible uniquement quand l'utilisateur est redirigé depuis le layout dashboard
 * On ne fait AUCUNE redirection ici pour éviter les boucles infinies
 * Le layout dashboard gère déjà la vérification du trial et redirige vers ici si nécessaire
 */
export default async function TrialExpireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pas de vérification ici - le layout dashboard gère déjà la redirection
  // Si l'utilisateur arrive ici, c'est que le trial est expiré
  return <>{children}</>;
}
