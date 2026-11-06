# Installation locale

## Prérequis

- Node.js **22.12 ou plus récent** (voir `engines` dans `package.json`).
- Docker (la pile Supabase locale tourne en conteneurs).
- Aucun compte externe n'est nécessaire pour développer : Stripe, Resend, registres et Turnstile sont facultatifs en local.

## 1. Dépendances

```bash
npm ci
```

La CLI Supabase est une dépendance de développement (`npx supabase …`).

## 2. Pile Supabase locale

```bash
npm run supabase:start
```

Démarre PostgreSQL 17, Auth, Storage, l'API REST et Mailpit (les services non utilisés sont exclus). Au premier démarrage, toutes les migrations de `supabase/migrations/` sont appliquées, puis `supabase/seed.sql` qui **ouvre la publication payante en France et en Belgique pour le développement uniquement**.

Si le registre d'images par défaut est inaccessible depuis votre réseau :

```bash
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npm run supabase:start
```

## 3. Fichiers d'environnement

```bash
npm run test:env -- --app
```

- `.env.test.local` : clés de la pile locale pour les tests (toujours régénéré) ;
- `.env.local` : configuration de l'application en développement (créé seulement s'il n'existe pas) — e-mails via le SMTP de Mailpit, `CRON_SECRET` et secret de webhook de développement.

Ces fichiers sont ignorés par Git. Toutes les variables sont documentées dans [`.env.example`](../.env.example).

## 4. Lancer l'application

```bash
npm run dev
```

- Application : http://localhost:3000 (redirige vers `/fr`).
- E-mails (confirmation d'inscription, notifications) : Mailpit, http://127.0.0.1:54324.

## 5. Données de démonstration (facultatif, local uniquement)

```bash
npm run seed:dev
```

Crée des entreprises et des annonces clairement identifiées comme démonstration. Le script refuse de s'exécuter si `NEXT_PUBLIC_SUPABASE_URL` n'est pas une adresse locale.

## 6. Premier administrateur

Il n'existe **aucun compte administrateur par défaut**. Créez un compte normalement (inscription + confirmation de l'e-mail dans Mailpit), puis :

```bash
npm run admin:grant -- vous@example.com
```

Les autres rôles s'attribuent ensuite depuis `/fr/admin/users` (chaque changement est journalisé).

## 7. Tester les paiements Stripe en local (facultatif)

Sans clé Stripe, la page de paiement indique « Paiement indisponible » et rien n'est publié. Pour exercer le vrai flux avec un compte Stripe **de test** :

1. Renseignez `STRIPE_SECRET_KEY=sk_test_…` dans `.env.local`.
2. Avec la [CLI Stripe](https://docs.stripe.com/stripe-cli) :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

3. Copiez le secret `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`, puis redémarrez `npm run dev`.

Une annonce n'est publiée qu'à la réception de l'événement signé confirmant le paiement, jamais au retour sur la page de succès.

## 8. Tests

```bash
npm run test:unit
```

```bash
npm run test:integration
```

```bash
npm run test:e2e
```

Les tests d'intégration et E2E nécessitent la pile Supabase locale et le fichier `.env.test.local`. Les tests E2E démarrent le serveur de développement s'il ne tourne pas déjà, **sans interrogation des registres d'entreprises** (services tiers) pour que les résultats soient déterministes ; si vous réutilisez un serveur déjà lancé avec accès réseau, lancez-le avec `REGISTRY_FR_ENABLED=false REGISTRY_VIES_ENABLED=false`. Les événements Stripe y sont simulés par des **événements signés** envoyés au vrai point d'entrée du webhook (aucun appel à l'API Stripe).

## Dépannage

| Symptôme | Cause probable |
|---|---|
| `TEST_SUPABASE_PUBLISHABLE_KEY is missing` | lancer `npm run test:env` après `npm run supabase:start` |
| E-mails non reçus dans Mailpit | `.env.local` doit contenir `EMAIL_PROVIDER=smtp`, `SMTP_HOST=127.0.0.1`, `SMTP_PORT=54325` |
| « Trop de demandes » pendant les tests | les compteurs anti-abus sont partagés ; les tests les remettent à zéro (`resetRateLimits`) |
| Types TypeScript obsolètes après une migration | `npm run db:types` |
| Page 404 sur `/legal/…` | les textes sont dans `content/legal/{fr,en}/` |
