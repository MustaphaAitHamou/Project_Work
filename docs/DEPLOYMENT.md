# Mise en production

Ce guide décrit le déploiement de Tamurt Jobs :
- **Supabase** : base de données, authentification, stockage ;
- **Vercel** pour la **préproduction** uniquement ;
- un **VPS Iglao** pour la **production** (procédure complète dans [deploy/iglao/README.md](../deploy/iglao/README.md)) ;
- **Stripe** pour les paiements, **Resend** pour les e-mails ([EMAIL.md](EMAIL.md)).

Chaque étape qui dépend d'un compte externe est réalisée par le propriétaire ou avec ses accès. Ce qui a été vérifié, et comment, est consigné dans [LAUNCH_LOG.md](LAUNCH_LOG.md).

> Règles impératives : ne jamais déployer en production avec des clés Stripe de test ; ne jamais créer de compte administrateur de démonstration ; ne jamais exécuter `npm run seed:dev` ailleurs qu'en local (le script le refuse) ; n'ouvrir la publication payante d'un pays qu'après sa checklist de conformité.

## 1. Environnements

Deux environnements strictement isolés, chacun avec **son hébergement et son projet Supabase** :

| | Préproduction | Production |
|---|---|---|
| Hébergement | Vercel, projet `tamurt-jobs-preprod` | VPS Linux chez Iglao : Nginx, Node.js 22, systemd ([deploy/iglao](../deploy/iglao/README.md)) |
| Déploiement | automatique à chaque envoi sur `claude/jobs-lancement`, **après la CI complète** (`.github/workflows/preprod-vercel.yml`) | **manuel** depuis `main`, après la CI complète **et ton approbation** (`.github/workflows/deploy-iglao.yml`) |
| Retour arrière | Vercel → Deployments → Instant Rollback | `bin/rollback.sh` sur le serveur (quelques secondes) |
| Tâches planifiées | Vercel Cron (`vercel.json`) | cron du serveur (`deploy/iglao/cron/tamurt-jobs`) |
| `APP_ENV` | `preprod` | `production` |
| Projet Supabase | dédié (peut rester en offre gratuite) | dédié, offre Pro (sauvegardes quotidiennes, pas de mise en pause) |
| Stripe | mode test (`sk_test_…`) | mode live (`sk_live_…` ou clé restreinte `rk_live_…`) |
| Accès | protégé par `PREPROD_BASIC_AUTH` (`identifiant:mot de passe`) | public |
| Indexation | interdite (`robots.txt` et en-tête `X-Robots-Tag`) | autorisée |
| Données | comptes de test et données de démonstration (`scripts/preprod-seed.mjs`) | données réelles uniquement |

L'application est en production lorsque `APP_ENV=production` (ou, sans `APP_ENV`, `VERCEL_ENV=production`). `APP_ENV` prime : le projet de préproduction est « production » pour Vercel mais doit se comporter en préproduction. En production : le paiement est refusé si la clé Stripe n'est pas une clé live, les événements Stripe de test sont ignorés, et `/api/health` comme le tableau de bord signalent toute configuration manquante (y compris un `PREPROD_BASIC_AUTH` oublié).

### Variables ajoutées pour le lancement

| Variable | Où | Rôle |
|---|---|---|
| `APP_ENV` | préprod et prod | `preprod` ou `production` (voir ci-dessus) |
| `PREPROD_BASIC_AUTH` | préprod uniquement | `identifiant:mot de passe` (ASCII) demandés par le navigateur ; **jamais en production** |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | prod (et préprod pour tester) | identifiant éditeur AdSense `ca-pub-…` ; à définir **avant** le build (CSP, `ads.txt`). Voir [ADSENSE.md](ADSENSE.md) |
| `STRIPE_HTTP_CLIENT` | facultatif | `fetch` uniquement derrière un proxy HTTPS (tests locaux) ; inutile sur Vercel |
| `CLIENT_IP_HEADER` | prod Iglao | `x-real-ip` : adresse du visiteur transmise par Nginx (limites de débit, anti-robot). Sans elle, le tableau de bord signale `client_ip_header_missing` |
| `ADS_MODE` | facultatif | `placeholder` (défaut hors production : emplacements de test, aucune requête à Google), `test` (annonces de test AdSense), `live` (défaut en production), `off` |
| `NEXT_OUTPUT` | construction pour Iglao | `standalone` : serveur autonome, posé par `scripts/package-standalone.sh` |

La construction n'a besoin que des réglages publics (`NEXT_PUBLIC_*`, `APP_ENV`) : aucun secret n'est nécessaire dans GitHub Actions pour construire la production.

## 2. Supabase

1. Créer le projet. **Choisir la région** en fonction des marchés et de l'analyse des transferts de données (par exemple une région de l'Union européenne pour les utilisateurs européens) — décision à valider avec le conseil en protection des données.
2. Appliquer les migrations avec `scripts/supabase-apply-migrations.mjs`. Le script :
   - passe par l'API de gestion de Supabase, sans mot de passe de base ;
   - suffit avec un jeton personnel **limité au projet** et à la permission *Migrations* en lecture-écriture ;
   - n'applique jamais `seed.sql`.

```bash
SUPABASE_ACCESS_TOKEN=<jeton> node scripts/supabase-apply-migrations.mjs --project-ref <référence> --confirm-ref <référence> --dry-run
```

   Puis la même commande sans `--dry-run`.
   - L'historique est comparé par **nom de fichier** : une migration déjà appliquée n'est jamais rejouée.
   - Le gros fichier des villes est envoyé en 6 parties, car l'API refuse les requêtes de plus de quelques centaines de Ko.
   - L'API numérote elle-même les versions. Ne pas mélanger avec `supabase db push` sur le même projet sans `supabase migration repair` : la CLI compare les numéros de version, pas les noms.
   - Préproduction `swaxeycawxtaxflfepqa` : les 25 migrations y sont appliquées depuis le 26/11 (30 entrées d'historique, sans erreur).

3. **Authentication → URL configuration** : *Site URL* = `https://<domaine>` ; *Redirect URLs* : `https://<domaine>/auth/confirm`.
4. **Authentication → Email templates** : reprendre les modèles de `supabase/templates/` (confirmation, récupération, changement d'adresse). Ils pointent vers `{{ .SiteURL }}/auth/confirm` et sont multilingues.
5. **Authentication → Providers → Email** : confirmation d'e-mail obligatoire ; changement d'adresse sécurisé (double confirmation) ; mot de passe de 10 caractères minimum avec minuscules, majuscules et chiffres (valeurs de `supabase/config.toml`).
6. **Authentication → SMTP** : configurer un SMTP personnalisé (par exemple celui de Resend) pour que les e-mails d'authentification partent de votre domaine.
7. **Authentication → Attack protection** : activer Cloudflare Turnstile avec la clé secrète (la même que `TURNSTILE_SECRET_KEY`).
8. **API / Data API** : n'exposer que le schéma `public` (le schéma `app` contient des fonctions internes et ne doit pas être exposé).
9. **Storage** : les compartiments `resumes` et `verification-documents` (privés) et `company-logos` (public) sont créés par les migrations ; ne pas les rendre publics.
10. **Database → Backups** : offre Pro = sauvegarde quotidienne conservée 7 jours ; la restauration à un instant donné (PITR) est une option payante. Faire une sauvegarde manuelle avant le lancement (voir [RUNBOOK.md](RUNBOOK.md)).
11. **Authentication → Multi-Factor** : l'application TOTP est activée par défaut sur les projets hébergés. Le back-office l'exige (`security.admin_mfa_required`, vrai par défaut) : chaque membre de l'équipe enregistre une application d'authentification à sa première connexion au back-office. Ne jamais exécuter `supabase/seed.sql` sur un projet hébergé (il désactive cette exigence pour le développement local).

## 3. Vercel (préproduction uniquement)

**Offre.** Le plan Hobby est réservé à un usage personnel et non commercial. De plus, il fait échouer le déploiement de tâches planifiées plus fréquentes qu'une fois par jour. La préproduction d'un produit commercial relève donc de **Pro** (20 $ par mois, 20 $ d'usage inclus, un siège). C'est la décision du propriétaire.

**Configuration automatique.** `scripts/vercel-preprod-setup.mjs` configure le projet existant, de façon idempotente, sans jamais afficher de secret :
- Node.js 22 et région Paris (`cdg1`) ;
- les variables publiques ;
- `CRON_SECRET`, généré ;
- le webhook Stripe de **test** et son secret, copié directement dans Vercel ;
- le contournement réservé à l'automatisation, puisque le site est protégé par l'authentification Vercel.

Restent à saisir par le propriétaire, en *Sensitive* : `SUPABASE_SECRET_KEY` et `STRIPE_SECRET_KEY` (`sk_test_…`). Le portail client Stripe se règle avec `scripts/stripe-setup-portal.mjs --site-url <adresse de la préprod>`.

1. Créer le projet `tamurt-jobs-preprod` (framework Next.js, Node.js 22, région de fonctions proche de Supabase, par exemple Paris `cdg1`), lié au dépôt GitHub.
   - `vercel.json` désactive les déploiements automatiques de Vercel (`git.deploymentEnabled: false`) : c'est GitHub Actions qui déploie, **après** la réussite des tests.
2. Variables d'environnement du projet (cible *Production*, puisque la préproduction est le déploiement « production » de ce projet) :
   - `APP_ENV=preprod`, `NEXT_PUBLIC_SITE_URL=https://preprod.<domaine>` ;
   - Supabase de **préproduction** : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` (*Sensitive*) ;
   - Stripe **test** : `STRIPE_SECRET_KEY` (`sk_test_…`, *Sensitive*), `STRIPE_WEBHOOK_SECRET` (*Sensitive*) ;
   - e-mails : `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (*Sensitive*), `EMAIL_FROM` ;
   - `CRON_SECRET` (32 caractères aléatoires ou plus, *Sensitive*) ;
   - anti-robot : clés de test publiques de Cloudflare (`NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`, `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`), ou de vraies clés ;
   - protection d'accès :
     - soit **l'authentification Vercel sur tous les déploiements**, retenue le 26/11 : seuls les comptes de ton équipe Vercel entrent. Stripe et les tests passent par le contournement réservé à l'automatisation ;
     - soit `PREPROD_BASIC_AUTH=identifiant:mot de passe` (*Sensitive*), si des testeurs extérieurs à l'équipe doivent entrer.
3. Domaine `preprod.<domaine>` (enregistrement CNAME indiqué par Vercel), HTTPS automatique.
4. GitHub → Settings → Environments → `preprod` : guide pas à pas dans
   [DEPLOYMENT_PREPROD.md](DEPLOYMENT_PREPROD.md).
   - variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (Vercel → Settings → General) et `PREPROD_URL` ;
   - secrets `VERCEL_TOKEN` (jeton Vercel dédié au déploiement, limité à l'équipe, avec une date
     d'expiration) et `VERCEL_AUTOMATION_BYPASS_SECRET` (facultatif) ;
   - le workflow demande à Vercel de compiler le commit testé (`scripts/vercel-deploy-preprod.sh`).
5. Tâches planifiées (`vercel.json`) : **une exécution par jour** pour chacune (maintenance 03:07, file d'e-mails 04:15, alertes 05:35, en UTC), parce que l'offre Hobby refuse toute tâche plus fréquente (déploiement du 27/11 en échec : « Hobby accounts are limited to daily cron jobs »).
   - Rien n'est perdu : les e-mails partent juste après chaque action, la tâche ne sert qu'aux reprises.
   - Pour les tests, déclenchement manuel sécurisé, avec le secret des tâches et le contournement Vercel, lus dans `preprod-access.local.txt` :

```bash
node scripts/preprod-run-cron.mjs maintenance
```

   - La production Iglao garde son calendrier : maintenance toutes les heures, e-mails toutes les 10 minutes (`deploy/iglao/cron/tamurt-jobs`). Un test unitaire vérifie les deux.
6. Webhook Stripe **de test** vers `https://preprod.<domaine>/api/stripe/webhook` (voir section 4). La protection par mot de passe ne s'applique pas à `/api`, donc Stripe peut l'atteindre.

## 3 bis. Iglao (production)

Tout est décrit dans [deploy/iglao/README.md](../deploy/iglao/README.md) :
- offre VPS ;
- préparation du serveur ;
- HTTPS ;
- secrets ;
- déploiement par GitHub Actions avec ton approbation ;
- retour arrière ;
- journaux ;
- sauvegardes.

Ce qui change par rapport à Vercel est déjà pris en charge dans le code et la configuration :
- tâches planifiées par le cron du serveur ;
- adresse du visiteur lue dans `X-Real-IP` ;
- redirections relatives (sinon elles pointeraient vers le port interne de Node.js) ;
- tampons Nginx assez grands pour les cookies de session Supabase ;
- fichiers statiques servis par Nginx ;
- construction sans secret.

## 4. Stripe

1. Activer le compte en mode live au nom de l'entité qui vend (à confirmer : voir [COMPLIANCE_LAUNCH.md](COMPLIANCE_LAUNCH.md), section 3), avec son compte bancaire.
2. **Developers → Webhooks** : point d'entrée `https://<domaine>/api/stripe/webhook`, version d'API `2026-10-28.endive` (celle du SDK), avec les événements :
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.created`, `invoice.finalized`, `invoice.updated`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, `refund.created`, `refund.updated`.
   Copier le secret de signature dans `STRIPE_WEBHOOK_SECRET`.
3. **Portail client** (le bouton « Gérer le paiement et les factures » de l'espace recruteur l'ouvre) : `scripts/stripe-setup-portal.mjs --site-url https://<domaine>` le crée ou le met à jour (mise à jour du moyen de paiement, historique des factures, résiliation **en fin de période**, pas de changement d'offre). Sans configuration de portail dans le mode Stripe utilisé, le bouton affiche « Une erreur est survenue ». Relances, moyens de paiement et cartes de test : voir [STRIPE_TESTING.md](STRIPE_TESTING.md).
4. **Taxes** : configurer Stripe Tax et les immatriculations fiscales par pays (voir la checklist de conformité), puis `STRIPE_AUTOMATIC_TAX=true`. Tant que ce n'est pas fait, aucune taxe n'est calculée et le tableau de bord le signale.
5. **Tarifs** : le tarif de référence (5,95 € HT par annonce active et par mois) est créé par les migrations. Les tarifs par pays et devise se gèrent dans `/admin/pricing` ; le bouton « Créer le prix Stripe » crée le prix correspondant dans Stripe (sinon le montant est transmis au moment du paiement).
6. Avant ouverture : effectuer un paiement réel de faible montant, vérifier la publication **après** réception du webhook, puis le rembourser depuis `/admin/payments`.

## 5. E-mails transactionnels

Voir [EMAIL.md](EMAIL.md) :
- domaine Resend et enregistrements DNS (SPF, DKIM, DMARC) ;
- clé à saisir dans Vercel, sur le serveur et dans le SMTP de Supabase ;
- réglages d'authentification de Supabase ;
- état des vérifications.

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

1. La CI (`.github/workflows/ci.yml`) exécute, sur une pile Supabase éphémère :
   - typage, lint ;
   - tests unitaires, tests d'intégration SQL ;
   - build et tests E2E.

   Elle tourne sur chaque Pull Request et avant chaque déploiement.
2. **Préproduction :** chaque envoi sur `claude/jobs-lancement` relance la CI, puis déploie sur Vercel si elle réussit.
3. **Production :**
   1. appliquer d'abord les nouvelles migrations sur la base de production, avec `npx supabase db push` depuis un poste de confiance ;
   2. lancer **Production (Iglao)** depuis `main` ;
   3. approuver.
4. Les migrations sont additives et ne doivent pas être modifiées une fois appliquées en production. Ainsi, le code précédent reste compatible en cas de retour arrière.
