This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Pousse le projet sur GitHub (dépôt connecté à Vercel).
2. Sur [Vercel](https://vercel.com/new), importe le dépôt ; le framework Next.js est détecté automatiquement.
3. **Variables d’environnement** : dans les paramètres du projet Vercel, ajoute les variables listées dans `.env.example` :
   - **Obligatoires** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - Optionnelles (fonctionnalités IA) : `MISTRAL_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`
4. Déploie ; le build `next build` s’exécute sur Vercel.

Voir [Next.js deployment](https://nextjs.org/docs/app/building-your-application/deploying) pour plus de détails.
