# Mise en production

Ce guide décrit le déploiement sur **Supabase** (base de données, authentification, stockage) et **Vercel** (application), avec **Stripe** et un fournisseur d'e-mail. Chaque étape qui dépend d'un compte externe doit être réalisée par l'équipe : aucune n'a pu être validée en conditions réelles depuis l'environnement de développement (voir [STATUS.md](STATUS.md)).

> Règles impératives : ne jamais déployer en production avec des clés Stripe de test ; ne jamais créer de compte administrateur de démonstration ; ne jamais exécuter `npm run seed:dev` ailleurs qu'en local (le script le refuse) ; n'ouvrir la publication payante d'un pays qu'après sa checklist de conformité.

## 1. Environnements

Prévoir au minimum deux environnements isolés :

| | Préproduction (Preview Vercel) | Production |
|---|---|---|
| Projet Supabase | dédié | dédié |
| Stripe | mode test (`sk_test_…`) | mode live (`sk_live_…` ou clé restreinte `rk_live_…`) |
| Indexation | interdite (`robots.txt` bloque tout hors production) | autorisée |

L'application considère qu'elle tourne en production lorsque `VERCEL_ENV=production` (ou `APP_ENV=production` hors Vercel). Dans ce cas : le paiement est refusé si la clé Stripe n'est pas une clé live, les événements Stripe de test sont ignorés, et le tableau de bord d'administration signale toute configuration manquante.

## 2. Supabase

1. Créer le projet. **Choisir la région** en fonction des marchés et de l'analyse des transferts de données (par exemple une région de l'Union européenne pour les utilisateurs européens) — décision à valider avec le conseil en protection des données.
2. Appliquer les migrations (le fichier `seed.sql` n'est **pas** appliqué par cette commande) :

```bash
npx supabase link --project-ref <référence-du-projet>
```

```bash
npx supabase db push
```

3. **Authentication → URL configuration** : *Site URL* = `https://<domaine>` ; *Redirect URLs* : `https://<domaine>/auth/confirm`.
4. **Authentication → Email templates** : reprendre les modèles de `supabase/templates/` (confirmation, récupération, changement d'adresse). Ils pointent vers `{{ .SiteURL }}/auth/confirm` et sont multilingues.
5. **Authentication → Providers → Email** : confirmation d'e-mail obligatoire ; changement d'adresse sécurisé (double confirmation) ; mot de passe de 10 caractères minimum avec minuscules, majuscules et chiffres (valeurs de `supabase/config.toml`).
6. **Authentication → SMTP** : configurer un SMTP personnalisé (par exemple celui de Resend) pour que les e-mails d'authentification partent de votre domaine.
7. **Authentication → Attack protection** : activer Cloudflare Turnstile avec la clé secrète (la même que `TURNSTILE_SECRET_KEY`).
8. **API / Data API** : n'exposer que le schéma `public` (le schéma `app` contient des fonctions internes et ne doit pas être exposé).
9. **Storage** : les compartiments `resumes` et `verification-documents` (privés) et `company-logos` (public) sont créés par les migrations ; ne pas les rendre publics.
10. **Database → Backups** : activer la restauration à un instant donné (PITR) selon l'offre souscrite.

## 3. Vercel

1. Importer le dépôt GitHub (framework Next.js, Node.js 22).
2. Choisir une **région de fonctions** proche de la région Supabase.
3. Renseigner les variables d'environnement de [`.env.example`](../.env.example), séparément pour *Production* et *Preview* :
   - `NEXT_PUBLIC_SITE_URL` : URL publique canonique ;
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (secrète, jamais préfixée `NEXT_PUBLIC_`) ;
   - Stripe, e-mail, Turnstile, registres, `CRON_SECRET` (chaîne aléatoire de 32 caractères ou plus).
4. **Tâches planifiées** (`vercel.json`) : maintenance horaire (délais de grâce, échéances, conservation), envoi des e-mails toutes les 10 minutes, alertes emploi quotidiennes. Vercel les appelle avec `Authorization: Bearer <CRON_SECRET>`. Ces fréquences nécessitent une offre Vercel autorisant les tâches infra-quotidiennes ; sur une offre limitée à une exécution par jour, adapter `vercel.json` (les e-mails partent de toute façon immédiatement après chaque action, la tâche ne sert qu'aux reprises) ou appeler ces routes depuis un ordonnanceur externe avec le même en-tête.
5. Associer le domaine et forcer HTTPS (les en-têtes de sécurité, dont HSTS et la CSP, sont définis dans `next.config.ts`).

## 4. Stripe

1. Activer le compte en mode live (informations de Tamurt Services LLC, compte bancaire).
2. **Developers → Webhooks** : point d'entrée `https://<domaine>/api/stripe/webhook`, avec les événements :
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.created`, `invoice.finalized`, `invoice.updated`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, `refund.created`, `refund.updated`.
   Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`.
3. **Billing → Customer portal** : activer la mise à jour du moyen de paiement et l'historique des factures (le bouton « Gérer le paiement et les factures » de l'espace recruteur ouvre ce portail).
4. **Taxes** : configurer Stripe Tax et les immatriculations fiscales par pays (voir la checklist de conformité), puis `STRIPE_AUTOMATIC_TAX=true`. Tant que ce n'est pas fait, aucune taxe n'est calculée et le tableau de bord le signale.
5. **Tarifs** : le tarif de référence (5,95 € HT par annonce active et par mois) est créé par les migrations. Les tarifs par pays et devise se gèrent dans `/admin/pricing` ; le bouton « Créer le prix Stripe » crée le prix correspondant dans Stripe (sinon le montant est transmis au moment du paiement).
6. Avant ouverture : effectuer un paiement réel de faible montant, vérifier la publication **après** réception du webhook, puis le rembourser depuis `/admin/payments`.

## 5. E-mails transactionnels

1. Vérifier le domaine d'envoi chez le fournisseur (SPF, DKIM, DMARC).
2. Resend : `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM="Tamurt Jobs <no-reply@<domaine>>"`. Ou SMTP : `EMAIL_PROVIDER=smtp` et les variables `SMTP_*`.
3. Les e-mails sont mis en file (`email_outbox`) dans la même transaction que l'action qui les déclenche, envoyés immédiatement après la réponse, puis repris par la tâche planifiée en cas d'échec.

## 6. Vérification des entreprises

| Pays | Source | Variable |
|---|---|---|
| France | API Recherche d'entreprises (publique) | `REGISTRY_FR_ENABLED=true` |
| Belgique, Luxembourg, Espagne (et numéros de TVA UE) | VIES (publique) | `REGISTRY_VIES_ENABLED=true` |
| Royaume-Uni | Companies House | `COMPANIES_HOUSE_API_KEY` |
| Suisse | Zefix | `ZEFIX_USERNAME`, `ZEFIX_PASSWORD` |
| États-Unis, Canada | OpenCorporates (licence payante pour un usage commercial) | `OPENCORPORATES_API_TOKEN` |
| Algérie | aucun registre interrogeable automatiquement | revue manuelle sur justificatifs |

Sans source disponible, la vérification passe en revue manuelle ; elle n'est jamais validée automatiquement. La validation automatique n'est possible que si le pays l'autorise (`/admin/countries`) et que tous les contrôles forts réussissent.

## 7. Premier administrateur

Créer le compte par l'inscription normale sur le site de production (e-mail confirmé, mot de passe robuste), puis, depuis un poste de confiance et avec un fichier d'environnement de production **temporaire** :

```bash
node --env-file=.env.production.local scripts/grant-admin.mjs vous@<domaine> --yes
```

Supprimer ensuite ce fichier. Les autres rôles s'attribuent depuis `/admin/users`. Il est recommandé de limiter le nombre de super-administrateurs et d'utiliser des adresses nominatives.

## 8. Ouverture des marchés

Dans `/admin/countries/<code>` : renseigner chaque point de la checklist avec un conseil local (statut, notes, lien vers la preuve). La publication payante d'un pays ne peut être activée qu'une fois les points bloquants traités ; une dérogation exige une justification d'au moins 30 caractères, conservée dans le journal d'audit. Voir [COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md).

## 9. Checklist de lancement

- [ ] `/admin` : aucune alerte « Configuration incomplète pour la production ».
- [ ] Stripe : clé live, webhook live, paiement réel testé puis remboursé.
- [ ] E-mails : confirmation d'inscription et notification de candidature reçues sur une vraie boîte, sans passer en indésirables.
- [ ] Tâches planifiées : « File d'e-mails vide » et aucune erreur de webhook dans le tableau de bord.
- [ ] Aucun compte de démonstration ni de test ; administrateurs nominatifs uniquement.
- [ ] Textes juridiques validés, mentions entre crochets complétées (`content/legal/`).
- [ ] Checklist de conformité traitée pour chaque marché ouvert.
- [ ] Sauvegardes (PITR) actives ; procédure de restauration testée.
- [ ] Domaine en HTTPS ; `robots.txt` de production accessible ; `sitemap.xml` généré.

## 10. Mises à jour

1. Ouvrir une Pull Request : la CI (`.github/workflows/ci.yml`) exécute typage, lint, tests unitaires, tests d'intégration SQL, build et tests E2E sur une pile Supabase éphémère.
2. Après fusion, Vercel déploie automatiquement ; appliquer les nouvelles migrations avec `npx supabase db push` **avant** de promouvoir le déploiement si elles sont nécessaires au nouveau code.
3. Les migrations sont additives et ne doivent pas être modifiées une fois appliquées en production.
