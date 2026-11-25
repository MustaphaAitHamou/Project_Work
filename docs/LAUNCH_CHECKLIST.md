# Checklist de lancement — Tamurt Jobs

Préproduction visée : **jeudi 26 novembre 2026**. Lancement visé : **samedi 28 novembre 2026**, après accord explicite.

Ce fichier est la référence entre les sessions. Le journal des modifications, des tests et des décisions est dans [LAUNCH_LOG.md](LAUNCH_LOG.md).

## Statuts

| Statut | Sens |
| --- | --- |
| ✅ Terminé et testé | Vérifié par un test exécuté ou une vérification manuelle tracée dans le journal. L'existence du code ne suffit pas. |
| 🔄 En cours | Travail commencé. |
| ⬜ À faire | Pas commencé. |
| ⏳ En attente de toi | Bloqué par une information, un accès, une décision ou une action du propriétaire. |

La colonne **Lancement** indique si l'élément est **Bloquant** ou **Non bloquant** pour l'ouverture de samedi.

Branche de travail : `claude/jobs-lancement`, partie de `claude/jobs-inscription-anonymat`. Elle sera fusionnée dans `main` après ton accord.

## 1. Accès, informations et décisions du propriétaire

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| ACC-01 | Nom de domaine et accès DNS | ⏳ En attente de toi | Bloquant | E-mails, anti-robot, webhooks, Search Console, `ads.txt` (au domaine racine si Jobs est en sous-domaine). |
| ACC-02 | Vercel en offre Pro, deux projets (`tamurt-jobs-preprod`, `tamurt-jobs`), jeton d'API | ⏳ En attente de toi | Bloquant | Hobby interdit l'usage commercial et limite les tâches planifiées à une par jour. |
| ACC-03 | Supabase : projets préprod et prod en région UE, prod en Pro, jeton d'accès personnel | ⏳ En attente de toi | Bloquant | En gratuit : mise en pause après une semaine d'inactivité, aucune sauvegarde automatique. |
| ACC-04 | Stripe : clé secrète de test (formulaire sécurisé) | ✅ Terminé et testé | Bloquant | Clé injectée par le proxy de la session ; appel `GET /v1/account` réussi le 25/11. |
| ACC-05 | Stripe : entité titulaire du compte live, activation (identité, banque) | ⏳ En attente de toi | Bloquant | Le compte est **français (FR)** alors que les textes nomment Tamurt Services LLC (États-Unis) : à trancher. |
| ACC-06 | Resend : domaine vérifié et clé API (Vercel + SMTP Supabase) | ⏳ En attente de toi | Bloquant | Sans SMTP, l'e-mail de confirmation n'est pas envoyé et l'inscription échoue. |
| ACC-07 | Cloudflare Turnstile : clés de site et secrète | ⏳ En attente de toi | Bloquant | Protection contre les inscriptions automatisées. |
| ACC-08 | Identité complète de l'entreprise exploitante | ⏳ En attente de toi | Bloquant | Mentions légales obligatoires. Aucune information ne sera inventée. |
| ACC-09 | Choix des pays ouverts samedi | ⏳ En attente de toi | Bloquant | Checklists remplies par toi avec ton conseil, ou dérogation motivée de ton fait. |
| ACC-10 | Juriste : qui valide, quand | ⏳ En attente de toi | Bloquant | Sans relecture, lancer est ta décision et ton risque. |
| ACC-11 | TVA et facturation (comptable), Stripe Tax | ⏳ En attente de toi | Bloquant pour les paiements réels | Autoliquidation UE, clients sans numéro de TVA. |
| ACC-12 | Politique de remboursement et de résiliation | ⏳ En attente de toi | Bloquant (CGV) | Proposition rédigée à partir du comportement actuel du code. |
| ACC-13 | E-mails des administrateurs de production | ⏳ En attente de toi | Bloquant | Rôles attribués par `scripts/grant-admin.mjs`. |
| ACC-14 | Accord pour fusionner l'anonymisation dans `main` | ⏳ En attente de toi | Bloquant pour la prod | Vérifiable en préprod jeudi. |
| ACC-15 | AdSense : inscription, ajout du site, identifiant `ca-pub-…`, message « Réglementations européennes » | ⏳ En attente de toi | Non bloquant | La validation Google peut arriver après le lancement. |
| ACC-16 | Google Search Console (vérification DNS) | ⏳ En attente de toi | Non bloquant | |
| ACC-17 | Mesure d'audience : GA4 avec consentement, ou rien au lancement | ⏳ En attente de toi | Non bloquant | |
| ACC-18 | Sentry : projet Next.js et DSN | ⏳ En attente de toi | Non bloquant | Fortement recommandé. |
| ACC-19 | Surveillance de disponibilité (Better Stack ou UptimeRobot) sur `/api/health` | ⏳ En attente de toi | Non bloquant | |
| ACC-20 | Dépôt GitHub en privé | ⏳ En attente de toi | Non bloquant | Recommandé avant l'ouverture. |

## 2. Infrastructure

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| INF-01 | Distinction préprod / production indépendante de Vercel (`APP_ENV`) | 🔄 En cours | Bloquant | Le projet de préprod est « production » pour Vercel : il faut `APP_ENV=preprod`. |
| INF-02 | Préprod non indexée et protégée par mot de passe | 🔄 En cours | Bloquant | En-tête `X-Robots-Tag` et authentification HTTP Basic optionnelle. |
| INF-03 | Migrations appliquées sur Supabase préprod puis prod | ⏳ En attente de toi | Bloquant | Dépend d'ACC-03. Migration d'anonymisation avant le code. |
| INF-04 | Configuration Auth Supabase (URL du site, redirections, SMTP, anti-robot) | ⏳ En attente de toi | Bloquant | |
| INF-05 | Variables d'environnement Vercel (préprod et prod) | ⏳ En attente de toi | Bloquant | Liste exacte dans `docs/DEPLOYMENT.md`. |
| INF-06 | Domaine, DNS, HTTPS | ⏳ En attente de toi | Bloquant | Certificats gérés par Vercel. |
| INF-07 | SPF, DKIM, DMARC | ⏳ En attente de toi | Bloquant | |
| INF-08 | Sauvegarde avant lancement et procédure de restauration | ⬜ À faire | Bloquant | |
| INF-09 | Procédure de retour arrière (rollback) | ⬜ À faire | Bloquant | |
| INF-10 | Surveillance des erreurs (Sentry) | ⬜ À faire | Non bloquant | Intégration activée seulement si le DSN est fourni. |
| INF-11 | Point de santé pour la surveillance de disponibilité | ⬜ À faire | Non bloquant | `/api/health` existe, à vérifier. |

## 3. Stripe

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| STR-01 | Produit et tarif 5,95 € HT par mois et par annonce en mode test | ✅ Terminé et testé | Bloquant | Créé depuis le back-office contre le vrai Stripe de test (25/11). À refaire dans le back-office de préprod, qui a sa propre base. |
| STR-02 | Portail client (factures, moyen de paiement, résiliation en fin de période) | ⬜ À faire | Bloquant | |
| STR-03 | Webhook de préprod enregistré et secret dans Vercel | ⏳ En attente de toi | Bloquant | Dépend de l'URL de préprod. |
| STR-04 | Paiement réel en mode test (carte 4242) et activation de l'annonce | 🔄 En cours | Bloquant | Session Checkout de l'application vérifiée (5,95 €, EUR, métadonnées) ; abonnement réel → annonce activée par webhook (25/11). Reste : saisie de la carte sur la page Checkout, à la main en préprod (limite du proxy de la session, voir STRIPE_TESTING.md). |
| STR-05 | 3D Secure (cartes 3155 et 3184) | 🔄 En cours | Bloquant | Vérifié par API : annonce non publiée tant que le paiement n'est pas confirmé. Reste : défi 3D Secure sur la page Checkout, en préprod. |
| STR-06 | Paiement refusé à l'abonnement (carte 9995) | ✅ Terminé et testé | Bloquant | Refus `insufficient_funds` réel : aucun abonnement, annonce non publiée. Affichage du refus sur Checkout à revoir en recette. |
| STR-07 | Renouvellement, échec de renouvellement, impayé, expiration (horloges de test) | ✅ Terminé et testé | Bloquant | Horloge de test : renouvellement payé, échec (`past_due`, motif réel), suspension après grâce, régularisation, expiration (25/11). |
| STR-08 | Résiliation depuis le portail et fin d'annonce en fin de période | 🔄 En cours | Bloquant | Résiliation en fin de période vérifiée par API (annonce en ligne jusqu'au terme puis expirée). Reste : portail client à configurer (STR-02) et tester en préprod. |
| STR-09 | Remboursement depuis le back-office | ✅ Terminé et testé | Bloquant | Remboursement Stripe réel déclenché depuis le back-office (rôle finance), enregistré sur le paiement (25/11). |
| STR-10 | Factures et reçus (numérotation, mentions, PDF) | ⏳ En attente de toi | Bloquant | Mentions dépendantes de l'entité et de la TVA. |
| STR-11 | Relances de paiement (Smart Retries) alignées sur le délai de grâce de 3 jours | ⏳ En attente de toi | Bloquant | Réglage du tableau de bord Stripe, sans API. |
| STR-12 | Préparation du passage en live (produits, tarif, webhook, clés) | 🔄 En cours | Bloquant | Procédure écrite dans `docs/STRIPE_TESTING.md`. **Activation des paiements réels seulement après ton accord.** |
| STR-13 | Prix toujours en euros (conversion de devise Stripe désactivée) | ✅ Terminé et testé | Bloquant | Constaté en test réel : sans ce réglage, Checkout affichait 6,77 $US hors d'Europe. |
| STR-14 | Événements Stripe dans le désordre (facture avant abonnement) | ✅ Terminé et testé | Bloquant | Constaté en test réel : le premier paiement n'était pas rattaché à l'annonce. Corrigé et couvert par un test d'intégration. |
| STR-15 | Motif réel des paiements refusés (back-office et e-mail) | ✅ Terminé et testé | Non bloquant | |

## 4. Publicité

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| PUB-01 | Choix du produit : AdSense (Google Ads sert à acheter de la publicité) | ✅ Terminé et testé | Non bloquant | Vérifié dans l'aide Google le 24/11. |
| PUB-02 | Emplacements desktop et mobile sans décalage de mise en page | ⬜ À faire | Non bloquant | Jamais dans les espaces privés, l'authentification, le paiement ni les pages juridiques. |
| PUB-03 | Consentement via la CMP certifiée de Google (TCF), refus géré | ⬜ À faire | Non bloquant | Exigée pour l'EEE, le Royaume-Uni et la Suisse. |
| PUB-04 | Interrupteur d'activation dans le back-office | ⬜ À faire | Non bloquant | |
| PUB-05 | `ads.txt` généré depuis l'identifiant éditeur | ⬜ À faire | Non bloquant | |
| PUB-06 | Politique de sécurité (CSP) ouverte aux seuls domaines Google nécessaires | ⬜ À faire | Non bloquant | |
| PUB-07 | Textes cookies et confidentialité mis à jour | ⬜ À faire | Bloquant si la pub est activée | Ils promettent aujourd'hui « aucun cookie publicitaire ». |

## 5. Juridique et conformité

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| JUR-01 | 42 passages `[À COMPLÉTER]` / `[À VALIDER]` dans `content/legal/fr/` | ⏳ En attente de toi | Bloquant | Identité de l'entreprise (ACC-08) puis relecture professionnelle. |
| JUR-02 | Conditions de remboursement et de résiliation dans les conditions recruteurs | ⬜ À faire | Bloquant | Rédaction proposée, à valider (ACC-12). |
| JUR-03 | Checklists de conformité des 9 pays (11 points bloquants chacune) | ⏳ En attente de toi | Bloquant | Jamais validées artificiellement. Proposition de lancement progressif à fournir. |
| JUR-04 | Analyse pays par pays et liste des questions pour le juriste | ⬜ À faire | Bloquant | |
| JUR-05 | Traduction des textes juridiques (anglais existant ; espagnol et arabe affichés avec avertissement) | ⬜ À faire | Non bloquant | |

## 6. Sécurité

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| SEC-01 | Dépendances sans vulnérabilité élevée | 🔄 En cours | Bloquant | `npm audit --omit=dev`. |
| SEC-02 | Double authentification obligatoire au back-office | ⬜ À faire | Bloquant | Le back-office accède aux CV et aux paiements. |
| SEC-03 | Isolation des données (RLS) et contrôle des routes | 🔄 En cours | Bloquant | Couvert par les tests d'intégration, à relancer. |
| SEC-04 | Limitation de débit, anti-spam, anti-robot | 🔄 En cours | Bloquant | Limiteur PostgreSQL existant ; Turnstile dépend d'ACC-07. |
| SEC-05 | Aucune donnée de test, clé ni outil de débogage en production | ⬜ À faire | Bloquant | Vérification avant GO. |
| SEC-06 | Antivirus des CV | ⬜ À faire | Non bloquant | Contrôles structurels seulement aujourd'hui. |
| SEC-07 | Test d'intrusion externe | ⬜ À faire | Non bloquant | Après lancement. |

## 7. SEO et préparation commerciale

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| SEO-01 | `robots.txt`, `sitemap.xml`, canonical, hreflang | 🔄 En cours | Bloquant | Existants ; à revérifier avec `APP_ENV`. |
| SEO-02 | Données structurées `JobPosting` | 🔄 En cours | Non bloquant | Existantes ; à valider. |
| SEO-03 | Prévisualisation réseaux sociaux (Open Graph) | ⬜ À faire | Non bloquant | |
| SEO-04 | Pages d'erreur | 🔄 En cours | Non bloquant | Existantes. |
| SEO-05 | Accessibilité et performances mobiles | ⬜ À faire | Non bloquant | Tests axe existants. |

## 8. Tests et recette

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| TST-01 | Typage, lint, tests unitaires | 🔄 En cours | Bloquant | |
| TST-02 | Tests d'intégration (pile Supabase locale) | 🔄 En cours | Bloquant | |
| TST-03 | Tests E2E (candidat, recruteur, admin, webhook, tâches planifiées, accessibilité) | ⬜ À faire | Bloquant | |
| TST-04 | Parcours sur ordinateur, tablette, smartphone et dans les 4 langues | ⬜ À faire | Bloquant | |
| TST-05 | Checklist de recette manuelle exhaustive | ⬜ À faire | Bloquant | `docs/RECETTE.md`. |
| TST-06 | Procédure de signalement de bugs | ⬜ À faire | Bloquant | |

## 9. Préproduction (jeudi 26)

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| PRE-01 | URL de préprod en ligne | ⏳ En attente de toi | Bloquant | Dépend d'ACC-01 à ACC-03. |
| PRE-02 | Comptes de test (candidat, recruteur, administrateur) | ⬜ À faire | Bloquant | |
| PRE-03 | Jeu de données de démonstration, jamais en production | ⬜ À faire | Bloquant | |
| PRE-04 | Cartes Stripe de test documentées | ⬜ À faire | Bloquant | |

## 10. Production (samedi 28)

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| PRD-01 | Résultats de ta recette vérifiés, derniers bugs corrigés | ⬜ À faire | Bloquant | |
| PRD-02 | Configuration de production vérifiée (`/api/health` sans problème) | ⬜ À faire | Bloquant | |
| PRD-03 | Activation commerciale du compte Stripe vérifiée | ⏳ En attente de toi | Bloquant | |
| PRD-04 | Produit, tarif et webhook live | ⬜ À faire | Bloquant | Après ton accord. |
| PRD-05 | Données de test séparées des données réelles | ⬜ À faire | Bloquant | Projets Supabase et Vercel distincts. |
| PRD-06 | Conformité des pays ouverts | ⏳ En attente de toi | Bloquant | |
| PRD-07 | Sauvegarde, rollback, bilan GO / NO GO | ⬜ À faire | Bloquant | **Mise en ligne publique et paiements réels seulement après ton accord explicite.** |
