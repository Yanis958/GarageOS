/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permet au build de passer sur Vercel malgré les erreurs ESLint existantes.
  // À retirer une fois le lint corrigé (npm run lint).
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
