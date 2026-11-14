# Tamurt Jobs

Plateforme internationale d'offres d'emploi de **Tamurt Services LLC** — « Le talent avant les préjugés ».

- **Candidats** : profil gratuit, CV versionnés stockés en privé, candidature en un clic sans redirection, suivi honnête des statuts (« consultée » uniquement si un recruteur a réellement ouvert la candidature), alertes, export et suppression des données.
- **Entreprises vérifiées** : vérification par registres officiels (France, Royaume-Uni, UE/VIES, Suisse, États-Unis/Canada via OpenCorporates) ou revue manuelle, publication payante **par annonce active et par mois** (Stripe Checkout + Billing, renouvellement automatique, résiliable sans engagement), réception sécurisée des candidatures. **Aucune messagerie** entre candidats et recruteurs, **aucun accès à une base de CV**.
- **Back-office** : rôles distincts (super-admin, vérification, modération, finance, protection des données, support), modération humaine, signalements, activation des 9 marchés après checklist de conformité, tarifs par pays/devise, paiements et remboursements, demandes RGPD, journal d'audit, API interne **Tamurt HQ** (indicateurs agrégés uniquement).
- **9 marchés** : France, Algérie, Canada, États-Unis, Suisse, Luxembourg, Espagne, Royaume-Uni, Belgique — **4 langues** : français, anglais, espagnol, arabe (RTL) — **6 devises** : EUR, USD, CAD, DZD, CHF, GBP.

> État réel du projet, éléments testés et points bloqués : **[docs/STATUS.md](docs/STATUS.md)**.

## Identité visuelle

Tamurt Jobs suit la direction artistique de la famille **Tamurt Services** :
- **Couleur** : bleu de travail `#2747b0` (`#93a9f4` en sombre) sur les neutres chauds communs à la famille. Le rouge Tamurt est réservé au bouton yaz ; l'or est réservé aux étoiles d'évaluation.
- **Police** : Bitter, aux empattements carrés comme un contrat tapé ou une annonce de journal. Noto Serif prend le relais pour les lettres kabyles (ɛ, ɣ) et Noto Naskh Arabic pour l'arabe ; ces deux polices ne se téléchargent que si une lettre les demande.
- **Formes** : coins de 4 px (boutons, champs, puces) et de 6 px (cartes), frise « peigne » sous l'accueil.
- **Fichiers** : logos dans `public/brand`, favicons et icône Apple dans `public/icons` et `public/icon.svg` ; jetons dans `src/app/globals.css`.
- **Bouton yaz** rouge en haut à droite, affiché si `TAMURT_SERVICES_URL` est renseignée.

## Pile technique

Next.js 16 (App Router, TypeScript strict) · Tailwind CSS 4 · composants Radix/shadcn · Supabase (PostgreSQL 17, Auth, Storage privé, RLS) · Stripe (Checkout, Billing, webhooks signés) · Resend ou SMTP · next-intl · Vitest · Playwright + axe-core · GitHub Actions · Vercel.

## Démarrage rapide (local)

Prérequis : Node.js ≥ 22.12, Docker.

```bash
npm ci
```

```bash
npm run supabase:start
```

```bash
npm run test:env -- --app
```

```bash
npm run dev
```

L'application est servie sur http://localhost:3000, les e-mails sont visibles dans Mailpit (http://127.0.0.1:54324). Détails, données de démonstration locales et premier administrateur : [docs/INSTALLATION.md](docs/INSTALLATION.md).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | serveur de développement, build et serveur de production |
| `npm run typecheck` · `npm run lint` | TypeScript strict · ESLint |
| `npm run test:unit` | tests unitaires (validation, fichiers, e-mails, permissions, traductions ICU) |
| `npm run test:integration` | tests d'intégration SQL contre Supabase local (RLS, candidature, facturation, décisions d'administration) |
| `npm run test:e2e` | tests de bout en bout Playwright (parcours candidat, recruteur, webhooks Stripe, back-office, accessibilité) |
| `npm run supabase:start` · `supabase:stop` · `db:reset` | pile Supabase locale |
| `npm run db:types` · `db:lint` | types TypeScript générés · analyse statique des fonctions SQL |
| `npm run seed:dev` | données de démonstration **locales uniquement** (refuse toute base non locale) |
| `npm run admin:grant -- <email>` | attribue le rôle super-admin à un compte existant et confirmé |

## Documentation

| Document | Contenu |
|---|---|
| [INSTALLATION](docs/INSTALLATION.md) | installation locale, Stripe en local, dépannage |
| [DEPLOYMENT](docs/DEPLOYMENT.md) | mise en production Supabase, Vercel, Stripe, e-mails, tâches planifiées, checklist de lancement |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | organisation du code, flux de paiement, vérification, modération, e-mails, choix techniques |
| [SECURITY](docs/SECURITY.md) | modèle de menace, contrôles en place, limites connues |
| [DATA_RETENTION](docs/DATA_RETENTION.md) | durées de conservation appliquées et à définir |
| [COMPLIANCE_CHECKLIST](docs/COMPLIANCE_CHECKLIST.md) | points réglementaires à valider pays par pays |
| [TAMURT_HQ_API](docs/TAMURT_HQ_API.md) | API interne d'indicateurs agrégés |
| [STATUS](docs/STATUS.md) | fait, testé, bloqué |

Les textes juridiques (`content/legal/`) sont des **projets à faire valider** par un conseil juridique ; ils sont affichés avec un bandeau l'indiquant.
