# Déploiement automatique de la préproduction (GitHub Actions → Vercel)

À chaque push sur `claude/jobs-lancement`, le workflow **Préproduction (Vercel)** :
1. exécute toute la CI (types, lint, tests unitaires, base de données, intégration, end-to-end) ;
2. **seulement si elle réussit**, demande à Vercel de compiler et de déployer **ce commit exact**
   (`scripts/vercel-deploy-preprod.sh`, API Vercel, source Git) ;
3. vérifie que le déploiement est `READY`, qu'il porte bien ce commit, que l'alias de préproduction
   le sert, que **Vercel Authentication refuse toujours un visiteur anonyme**, puis la santé
   (`/api/health`) et l'en-tête `noindex`.

Vercel ne déploie rien de lui-même (`vercel.json` : `git.deploymentEnabled: false`). Les secrets
de l'application (Supabase, Stripe test, Turnstile…) restent dans le projet Vercel et ne
transitent jamais par GitHub.

Tant que les réglages ci-dessous manquent, le workflow **échoue** à l'étape « Vercel access
configured ». Il n'annonce jamais un succès sans avoir déployé.

> Le dépôt GitHub est **public** : ne mettez aucun secret dans le code, les issues ou les
> journaux. Les secrets vont uniquement dans les formulaires « Secrets » de GitHub et de Vercel.

## 1. Créer le jeton Vercel (2 minutes)

1. Vercel → avatar en haut à droite → **Account Settings** → **Tokens**.
2. **Create Token** :
   - *Token name* : `github-actions-tamurt-jobs-preprod` ;
   - *Scope* : **l'équipe qui possède le projet `tamurt-jobs-preprod`**, pas « Full Account ».
     Vercel ne propose pas de jeton limité à un seul projet : l'équipe est la portée la plus étroite ;
   - *Expiration* : 90 jours (à renouveler avant l'échéance, voir § 5).
3. Copiez le jeton : Vercel ne l'affiche qu'une fois. Ne le collez nulle part ailleurs qu'au § 2.

## 2. Créer l'environnement GitHub « preprod » (5 minutes)

GitHub → dépôt **Project_Work** → **Settings** → **Environments** → **New environment** →
nom `preprod` → **Configure environment**.

1. **Deployment branches and tags** → *Selected branches and tags* → **Add deployment branch or
   tag rule** → `claude/jobs-lancement`. Les secrets ne servent alors qu'à cette branche.
   N'ajoutez pas de *Required reviewers* : le déploiement de préproduction doit rester automatique.
2. **Environment secrets** → **Add environment secret** :

   | Nom | Valeur |
   |---|---|
   | `VERCEL_TOKEN` | le jeton créé au § 1 |
   | `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel → projet `tamurt-jobs-preprod` → **Settings** → **Deployment Protection** → **Protection Bypass for Automation** : copiez le secret **existant** (ne le régénérez pas, les tests de préproduction l'utilisent aussi) |

   Le second secret est facultatif. Sans lui, le site est quand même déployé et sa protection
   vérifiée, mais la santé et `noindex` ne le sont pas.
3. **Environment variables** → **Add environment variable** :

   | Nom | Où le trouver |
   |---|---|
   | `VERCEL_ORG_ID` | Vercel → paramètres de l'**équipe** → **General** → *Team ID* (`team_…`) |
   | `VERCEL_PROJECT_ID` | Vercel → projet `tamurt-jobs-preprod` → **Settings** → **General** → *Project ID* (`prj_…`) |
   | `PREPROD_URL` | `https://tamurt-jobs-preprod.vercel.app` (sans `/` final) |

## 3. Lancer et vérifier

1. GitHub → **Actions** → **Préproduction (Vercel)** → **Run workflow** → branche
   `claude/jobs-lancement` (ou poussez un commit sur cette branche).
2. Résultat attendu, dans le résumé de l'exécution :
   - `ci / Typecheck, lint, unit tests` et `ci / Database, integration and end-to-end tests` : verts ;
   - `Deploy to Vercel (pre-production)` : vert, avec *Déploiement … état READY*, *Commit* (celui
     de l'exécution), *Alias*, *Protection Vercel Authentication : active*, *Santé HTTP*,
     *Indexation : noindex*.
3. En cas d'échec, le message dit quoi faire :

   | Message | Cause probable |
   |---|---|
   | `missing in the GitHub environment 'preprod': …` | variable ou secret absent, ou faute de frappe dans son nom |
   | `API Vercel GET /v9/projects : HTTP 403` | portée du jeton : il n'inclut pas l'équipe du projet |
   | `HTTP 401` | jeton expiré ou révoqué (§ 5) |
   | `Déploiement … : ERROR` | la compilation a échoué chez Vercel : ouvrir le déploiement dans Vercel → *Build Logs* |
   | `… répond 200 sans authentification` | Vercel Authentication a été désactivée : la réactiver (Settings → Deployment Protection) |

## 4. Équivalent manuel

Le même script se lance à la main (par exemple depuis une session de développement qui dispose
déjà d'un accès Vercel), sans jamais saisir de secret dans une conversation :

```bash
GIT_REPOSITORY=MustaphaAitHamou/Project_Work GIT_REF=claude/jobs-lancement GIT_SHA=$(git rev-parse HEAD) PREPROD_URL=https://tamurt-jobs-preprod.vercel.app bash scripts/vercel-deploy-preprod.sh
```

Il faut aussi `VERCEL_TOKEN`, `VERCEL_ORG_ID` et `VERCEL_PROJECT_ID` dans l'environnement du
terminal. Le commit doit déjà être poussé sur GitHub.

Depuis un poste dont le réseau ne joint que l'alias de préproduction (proxy d'entreprise, session de
développement), ajoutez `SKIP_DEPLOYMENT_URL_CHECKS=1`. L'adresse unique du déploiement n'est alors
pas contrôlée, et le résumé l'indique. Ne l'utilisez jamais dans GitHub Actions.

Après un déploiement, les contrôles de la préproduction réelle se lancent ainsi (ils ne créent
rien et n'envoient aucun e-mail) :

```bash
PREPROD_TURNSTILE_KEYS=real npx playwright test -c playwright.preprod.config.ts --trace off
```

## 5. Entretien et sécurité

- **Renouveler le jeton** avant son expiration : Vercel → Tokens → créer le nouveau, le coller dans
  GitHub (secret `VERCEL_TOKEN`), lancer le workflow, puis supprimer l'ancien dans Vercel.
- **En cas de doute** (jeton exposé) : le supprimer immédiatement dans Vercel. Le workflow
  échouera jusqu'au nouveau jeton, et le site reste en ligne et protégé.
- Les journaux GitHub masquent les secrets, et le script ne les affiche jamais.
- Un dépôt public ne transmet pas les secrets aux *pull requests* venant de forks. Le workflow ne
  se déclenche que sur un push de la branche ou à la main.
- La production (Iglao) a son propre workflow, avec approbation manuelle :
  [deploy/iglao/README.md](../deploy/iglao/README.md). Ce guide ne la concerne pas.
