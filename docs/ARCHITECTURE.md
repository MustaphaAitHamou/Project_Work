# Architecture

## Vue d'ensemble

```
Navigateur ──HTTPS──▶ Vercel : Next.js 16 (App Router)
                       ├─ proxy.ts : langue (next-intl), rafraîchissement de session Supabase, protection des espaces privés
                       ├─ Server Components : lecture des données avec la session de l'utilisateur (RLS)
                       ├─ Server Actions : mutations → fonctions SQL (contrôles + audit dans la même transaction)
                       └─ Route Handlers /api : fichiers, webhook Stripe, tâches planifiées, API Tamurt HQ
                               │
                               ▼
                       Supabase : PostgreSQL 17 (RLS partout) · Auth · Storage privé
                               │
         Stripe (Checkout, Billing, webhooks signés) · Resend/SMTP · registres officiels · Turnstile
```

## Organisation du code

| Dossier | Contenu |
|---|---|
| `src/app/[locale]/` | pages publiques, authentification, espaces `candidate/`, `employer/`, `admin/` |
| `src/app/api/` | routes HTTP (CV, justificatifs, logos, export, Stripe, cron, HQ, santé) |
| `src/lib/` | logique serveur : `supabase/`, `auth/`, `billing/`, `companies/verification/`, `email/`, `files/`, `security/`, `privacy/`, `hq/` |
| `src/components/` | composants d'interface (Radix/shadcn), formulaires, graphiques du back-office |
| `supabase/migrations/` | schéma, fonctions, RLS, droits, données de référence (pays, villes, secteurs, règles de modération, checklist) |
| `messages/` | traductions fr, en, es, ar (format ICU) |
| `content/legal/` | projets de textes juridiques (Markdown) |
| `tests/` | unitaires, intégration SQL, E2E Playwright |

## Données et sécurité au niveau de la base

- **RLS activée sur toutes les tables**, avec des droits explicites par colonne pour les mises à jour faites directement par les utilisateurs. Les privilèges par défaut sont révoqués pour `anon` et `authenticated`.
- **Fonctions métier en SQL** (`SECURITY DEFINER`, `search_path` vide) : candidature, vérification, facturation, décisions d'administration. Elles vérifient l'acteur et ses droits, écrivent l'audit et mettent les e-mails en file dans la même transaction. Les erreurs métier ont des codes stables (`P0001`) traduits côté interface.
- Le schéma **`app`** (non exposé par l'API) contient les fonctions internes : matrice de permissions, audit, file d'e-mails, limitation de débit, aides de facturation.
- La **matrice de permissions** du back-office existe en SQL (référence) et en TypeScript (navigation) ; un test unitaire garantit qu'elles sont identiques.

## Fichiers

- Compartiments **privés** `resumes` et `verification-documents` : aucune politique d'accès directe ; tout passe par une route serveur qui contrôle les droits en SQL, journalise l'accès, puis redirige vers une **URL signée valable 60 secondes** (téléchargement forcé).
- Contrôles à l'envoi : taille, type réel (signature binaire), PDF sans contenu actif ni chiffrement, DOCX sans macros ni objets intégrés, détection des archives anormales.
- Les CV sont **versionnés** : une candidature référence la version transmise ; les versions inutilisées sont effacées par la maintenance.

## Candidature en un clic

`apply_to_job` vérifie en une transaction (avec verrou consultatif) : compte candidat actif, profil complet, CV principal valide, accord de transmission à la version en vigueur, offre ouverte, limite quotidienne. Elle fige une **copie du profil** transmis et notifie le recruteur et le candidat. Le statut « consultée » n'est posé que par l'ouverture effective de la candidature par un membre de l'entreprise.

## Paiement et publication

```
Recruteur ──▶ billing_prepare_checkout (contrôles) ──▶ Stripe Checkout (abonnement mensuel)
Stripe ──webhook signé──▶ /api/stripe/webhook
        ├─ vérification de signature, mode live/test cohérent avec l'environnement
        ├─ registre d'idempotence (stripe_events) : chaque événement n'est traité qu'une fois
        ├─ garde d'ordre : un événement plus ancien n'écrase pas un état plus récent
        └─ billing_* : activation de l'annonce, renouvellement, échec, résiliation, remboursement
```

- **Une annonce n'est jamais activée par le retour sur l'URL de succès** : la page de retour se contente d'afficher l'état connu en base.
- Échec de renouvellement : délai de grâce (3 jours par défaut) puis suspension, réactivation automatique au paiement.
- Clôture, refus, suspension, échéance ou suppression de compte : arrêt du renouvellement en fin de période (`cancel_at_period_end`).
- Les montants affichés dans le back-office proviennent uniquement des événements Stripe.

## Vérification des entreprises

`src/lib/companies/verification/` : validation locale des identifiants (formats et clés de contrôle), interrogation des registres disponibles par pays, puis contrôles (existence, activité, raison sociale, code postal, représentant, e-mail professionnel, domaine). Décision conservatrice : refus uniquement si le registre indique une entreprise inactive ; validation automatique uniquement si tous les contrôles forts réussissent **et** si le pays l'autorise ; sinon revue manuelle. Les justificatifs sont supprimés après 90 jours.

## Modération et non-discrimination

- Règles (expressions régulières par langue) appliquées au texte normalisé : elles **signalent** une annonce pour revue humaine, ne la refusent jamais.
- Toute modification d'une annonce approuvée déclenche un nouvel examen (empreinte du contenu approuvé).
- Pas de photo, pas de nationalité ni d'origine collectées ; aucun score calculé sur les candidats ; classement des offres expliqué publiquement.
- Aucune messagerie entre candidats et recruteurs.

## E-mails

Modèle « transactional outbox » : la ligne `email_outbox` est écrite dans la transaction métier ; l'envoi est déclenché juste après la réponse (`after()`), puis repris par la tâche planifiée (`email_claim_batch` avec `FOR UPDATE SKIP LOCKED`, tentatives limitées). Fournisseur interchangeable (Resend ou SMTP). Les textes sont traduits ; l'administration peut les personnaliser par langue (variables échappées).

## Recherche

PostgreSQL : recherche plein texte pondérée (intitulé > compétences > description), suggestions par trigrammes, filtre par distance (formule de haversine sur les coordonnées des villes GeoNames incluses dans les migrations), filtres par pays, région, contrat, télétravail autorisé depuis un pays, salaire annualisé, date, secteur, langue.

## Internationalisation

next-intl avec préfixe de langue obligatoire (`/fr`, `/en`, `/es`, `/ar`), messages ICU, arabe en `dir="rtl"` (composants Radix en mode RTL), noms de pays et de langues générés à l'avance pour éviter les différences entre serveur et navigateur.

## Choix techniques notables

- **`cacheComponents` désactivé** : la plupart des pages dépendent de la session et de données à jour (statuts de paiement, modération). Le rendu dynamique par requête a été préféré à la complexité de l'invalidation fine ; le sitemap est régénéré au plus toutes les heures.
- **Limitation de débit dans PostgreSQL** (fenêtres fixes, table non journalisée) plutôt qu'un service payant ; l'adresse IP n'est jamais stockée en clair (empreinte salée).
- **Graphiques du back-office en SVG** sans bibliothèque, avec info-bulles accessibles au clavier et table de données.
- **API Tamurt HQ** séparée, en lecture seule, n'exposant que des agrégats (voir [TAMURT_HQ_API.md](TAMURT_HQ_API.md)).
