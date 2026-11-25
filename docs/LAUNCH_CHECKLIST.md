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
| ACC-21 | Mentions « 9 pays » du site si seule la France ouvre | ⏳ En attente de toi | Bloquant si France seule | Description du site, bandeau de l'accueil, page recruteurs : risque de mention trompeuse. Proposition : « en France » au lancement. |

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
| INF-08 | Sauvegarde avant lancement et procédure de restauration | 🔄 En cours | Bloquant | Procédure dans `docs/RUNBOOK.md` ; sauvegarde à faire le jour J (dépend d'ACC-03). |
| INF-09 | Procédure de retour arrière (rollback) | ✅ Terminé et testé | Bloquant | `docs/RUNBOOK.md` (Instant Rollback Vercel, interrupteurs publicité et pays, clés, migrations). |
| INF-10 | Surveillance des erreurs (Sentry) | 🔄 En cours | Non bloquant | Intégrée (SDK 11.11.0), activée seulement si `NEXT_PUBLIC_SENTRY_DSN` est défini : serveur, edge, navigateur via le tunnel `/monitoring`, aucune donnée personnelle envoyée. Erreurs seulement : plus d'envoi de « session » à chaque page vue ; les erreurs du navigateur portent le bon environnement (`preprod` constaté dans le build de préprod, 25/11). Reste : DSN réel (ACC-18), puis `/api/health?monitoring=test` pour vérifier la réception. |
| INF-11 | Point de santé pour la surveillance de disponibilité | ✅ Terminé et testé | Non bloquant | `/api/health` : 503 si la base est inaccessible. En production, la réponse publique se limite à `status` et `database` ; le détail de la configuration est dans le back-office (bloc « État des intégrations ») ou avec le secret des tâches planifiées. Tests unitaires 3/3 (25/11). |

## 3. Stripe

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| STR-01 | Produit et tarif 5,95 € HT par mois et par annonce en mode test | ✅ Terminé et testé | Bloquant | Créé depuis le back-office contre le vrai Stripe de test (25/11). À refaire dans le back-office de préprod, qui a sa propre base. |
| STR-02 | Portail client (factures, moyen de paiement, résiliation en fin de période) | 🔄 En cours | Bloquant | **Mode test : configuré le 25/11** par `scripts/stripe-setup-portal.mjs` (configuration par défaut : factures, moyen de paiement, nom, adresse et TVA, résiliation en fin de période avec motif, pas de changement d'offre). Vérifié contre le vrai Stripe de test : réglages relus par l'API, ouverture depuis l'espace recruteur (redirection vers billing.stripe.com), un abonnement par annonce nommé d'après l'annonce. Une erreur Stripe affiche désormais un message au lieu d'une page d'erreur. Reste : écran du portail à vérifier en préprod (R-11, R-12), car ses fichiers viennent d'un domaine bloqué dans cette session ; liens CGV et confidentialité une fois le domaine connu ; configuration live au lancement. |
| STR-03 | Webhook de préprod enregistré et secret dans Vercel | ⏳ En attente de toi | Bloquant | Dépend de l'URL de préprod. |
| STR-04 | Paiement réel en mode test (carte 4242) et activation de l'annonce | 🔄 En cours | Bloquant | Session Checkout de l'application vérifiée (5,95 €, EUR, métadonnées) ; abonnement réel → annonce activée par webhook (25/11). Reste : saisie de la carte sur la page Checkout, à la main en préprod (limite du proxy de la session, voir STRIPE_TESTING.md). |
| STR-05 | 3D Secure (cartes 3155 et 3184) | 🔄 En cours | Bloquant | Vérifié par API : annonce non publiée tant que le paiement n'est pas confirmé. Reste : défi 3D Secure sur la page Checkout, en préprod. |
| STR-06 | Paiement refusé à l'abonnement (carte 9995) | ✅ Terminé et testé | Bloquant | Refus `insufficient_funds` réel : aucun abonnement, annonce non publiée. Affichage du refus sur Checkout à revoir en recette. |
| STR-07 | Renouvellement, échec de renouvellement, impayé, expiration (horloges de test) | ✅ Terminé et testé | Bloquant | Horloge de test : renouvellement payé, échec (`past_due`, motif réel), suspension après grâce, régularisation, expiration (25/11). |
| STR-08 | Résiliation depuis le portail et fin d'annonce en fin de période | 🔄 En cours | Bloquant | Vérifié contre le vrai Stripe de test (25/11) : résiliation en fin de période, annonce en ligne jusqu'au terme puis expirée ; avec deux annonces, résilier l'une n'affecte pas l'autre, qui se renouvelle. Reste : clic « Annuler l'abonnement » dans l'écran du portail, en préprod (R-12). |
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
| PUB-02 | Emplacements desktop et mobile sans décalage de mise en page | ✅ Terminé et testé | Non bloquant | 5 emplacements publics étiquetés « Publicité », 280 px réservés, chargement à l'approche de l'écran. Jamais dans les espaces privés, l'authentification ni les pages juridiques (E2E `ads.spec.ts`, 25/11). |
| PUB-03 | Consentement via la CMP certifiée de Google (TCF), refus géré | ⏳ En attente de toi | Non bloquant | Code prêt : CMP de Google chargée avec AdSense, lien « Paramètres des cookies ». Reste : créer le message « Réglementations européennes » dans AdSense (ACC-15), puis vérifier l'affichage réel. |
| PUB-04 | Interrupteur d'activation dans le back-office | ✅ Terminé et testé | Non bloquant | Paramètres `ads.enabled` et `ads.slots`, désactivé par défaut (E2E). |
| PUB-05 | `ads.txt` généré depuis l'identifiant éditeur | ✅ Terminé et testé | Non bloquant | Contenu vérifié par E2E. Domaine racine à traiter si Jobs est en sous-domaine. |
| PUB-06 | Politique de sécurité (CSP) ouverte aux seuls domaines Google nécessaires | ✅ Terminé et testé | Non bloquant | Ouverte seulement si l'identifiant éditeur est configuré (E2E). Balise de vérification `google-adsense-account` ajoutée. |
| PUB-07 | Textes cookies et confidentialité mis à jour | 🔄 En cours | Bloquant si la pub est activée | Mis à jour en FR et EN le 25/11 (publicité seulement avec consentement, jamais avec les données de compte ou les CV). Passages `[À VALIDER]` pour le juriste ; ES et AR affichent les textes FR/EN. |

## 5. Juridique et conformité

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| JUR-01 | 42 passages `[À COMPLÉTER]` / `[À VALIDER]` dans `content/legal/fr/` | ⏳ En attente de toi | Bloquant | Identité de l'entreprise (ACC-08) puis relecture professionnelle. |
| JUR-02 | Conditions de remboursement et de résiliation dans les conditions recruteurs | ⏳ En attente de toi | Bloquant | Résiliation, renouvellement, échecs de paiement et suspension déjà rédigés (art. 5, 7, 11). Remboursement : proposition dans `docs/COMPLIANCE_LAUNCH.md` §5, à décider (ACC-12). |
| JUR-03 | Checklists de conformité des 9 pays (11 points bloquants chacune) | ⏳ En attente de toi | Bloquant | Jamais validées artificiellement. Proposition de lancement progressif à fournir. |
| JUR-04 | Analyse pays par pays et liste des questions pour le juriste | ✅ Terminé et testé | Bloquant | `docs/COMPLIANCE_LAUNCH.md` : lancement France seule proposé, ouverture progressive, 10 questions pour le juriste. |
| JUR-05 | Traduction des textes juridiques (anglais existant ; espagnol et arabe affichés avec avertissement) | ⬜ À faire | Non bloquant | |
| JUR-06 | Information de l'auteur d'un signalement sur la décision (DSA, art. 16, § 5) | ✅ Terminé et testé | Bloquant | E-mail à l'auteur (compte ou adresse du formulaire, dans sa langue) quand le signalement est traité ou classé, sans la note interne. Test d'intégration (25/11). CGU mises à jour. |

## 6. Sécurité

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| SEC-01 | Dépendances sans vulnérabilité élevée | ✅ Terminé et testé | Bloquant | Next.js 16.4.6 ; `npm audit --omit=dev` : 0 vulnérabilité (25/11). À refaire juste avant le lancement. |
| SEC-02 | Double authentification obligatoire au back-office | ✅ Terminé et testé | Bloquant | Application TOTP exigée par la base elle-même (`app.has_permission` refuse toute permission sans session aal2), réglage `security.admin_mfa_required` vrai par défaut, page d'enrôlement et de vérification (4 langues). Intégration 2/2 et E2E 1/1 (25/11). |
| SEC-03 | Isolation des données (RLS) et contrôle des routes | ✅ Terminé et testé | Bloquant | Tests d'intégration `security-rls` et parcours E2E verts (25/11). |
| SEC-04 | Limitation de débit, anti-spam, anti-robot | 🔄 En cours | Bloquant | Limiteur PostgreSQL existant ; Turnstile dépend d'ACC-07. |
| SEC-05 | Aucune donnée de test, clé ni outil de débogage en production | 🔄 En cours | Bloquant | Audit du code (25/11) : aucune route de test ou de débogage ; aucun `console.log` ; aucune source map publique (aucune dans le build, suppression après envoi à Sentry par défaut) ; migrations sans donnée de démonstration ; scripts de données qui refusent la production (`dev-seed` : base locale seulement, `preprod-seed` : projet de préprod seulement) ; aucun secret dans le dépôt ; page d'erreur sans détail technique (référence seulement) ; test de surveillance protégé par secret. Corrigé : `/api/health` révélait publiquement la configuration (mode Stripe, e-mail, anti-robot). Reste : contrôle sur le déploiement de production avant GO (variables, absence des comptes de recette, clés live, `PREPROD_BASIC_AUTH` absent). |
| SEC-06 | Antivirus des CV | ⬜ À faire | Non bloquant | Contrôles structurels seulement aujourd'hui. |
| SEC-07 | Test d'intrusion externe | ⬜ À faire | Non bloquant | Après lancement. |

## 7. SEO et préparation commerciale

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| SEO-01 | `robots.txt`, `sitemap.xml`, canonical, hreflang | ✅ Terminé et testé | Bloquant | Existants et liés à `APP_ENV` : indexation interdite hors production (robots + en-tête). Sitemap avec alternatives de langue. Vérifier en production après mise en ligne. |
| SEO-02 | Données structurées `JobPosting` | ✅ Terminé et testé | Non bloquant | Champs exigés par Google présents (titre, description, date, employeur, lieu ou télétravail, validité, contrat, salaire, identifiant, candidature directe) ; test unitaire existant. Test « résultats enrichis » de Google à faire sur l'URL de production. |
| SEO-03 | Prévisualisation réseaux sociaux (Open Graph) | 🔄 En cours | Non bloquant | Image 1200 × 630 aux couleurs de la marque (`opengraph-image.png`, `twitter-image.png`) ; vérification des balises au prochain build. |
| SEO-04 | Pages d'erreur | 🔄 En cours | Non bloquant | Existantes. |
| SEO-05 | Accessibilité et performances mobiles | ✅ Terminé et testé | Non bloquant | Axe WCAG A/AA sans violation (E2E). Mesure mobile (Pixel 7, CPU ×4, 4G lente) : LCP < 1 s, CLS 0,000 sur accueil FR/AR, recherche, entreprises, fiche d'offre, après correction du décalage de l'accueil (0,24). `scripts/measure-web-vitals.mjs`. À refaire en préprod sur le réseau réel. |

## 8. Tests et recette

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| TST-01 | Typage, lint, tests unitaires | ✅ Terminé et testé | Bloquant | Typage et lint verts ; unitaires 127/127 (25/11). À relancer à chaque lot. |
| TST-02 | Tests d'intégration (pile Supabase locale) | ✅ Terminé et testé | Bloquant | 49/49 (25/11). |
| TST-03 | Tests E2E (candidat, recruteur, admin, webhook, tâches planifiées, accessibilité) | ✅ Terminé et testé | Bloquant | 40/40 sur le build de préproduction (`APP_ENV=preprod`) le 25/11, plus 5 parcours Stripe réels (5/5). La suite standard suppose un serveur sans clé Stripe ; les parcours réels, un serveur avec la clé de test. |
| TST-04 | Parcours sur ordinateur, tablette, smartphone et dans les 4 langues | ⬜ À faire | Bloquant | |
| TST-05 | Checklist de recette manuelle exhaustive | ✅ Terminé et testé | Bloquant | `docs/RECETTE.md` (candidat, recruteur, administration, transverse, matrice appareils et langues). |
| TST-06 | Procédure de signalement de bugs | ✅ Terminé et testé | Bloquant | Message dans la conversation ou modèle GitHub « Bug de recette » (`.github/ISSUE_TEMPLATE/bug-recette.yml`). |

## 9. Préproduction (jeudi 26)

| ID | Élément | Statut | Lancement | Notes |
| --- | --- | --- | --- | --- |
| PRE-01 | URL de préprod en ligne | ⏳ En attente de toi | Bloquant | Dépend d'ACC-01 à ACC-03. |
| PRE-02 | Comptes de test (candidat, recruteur, administrateur) | 🔄 En cours | Bloquant | `scripts/preprod-seed.mjs` prêt et testé en local (candidat, recruteur vérifié, super admin, modération, finance ; mots de passe aléatoires dans un fichier ignoré par Git). À exécuter sur la préprod (dépend d'ACC-03). |
| PRE-03 | Jeu de données de démonstration, jamais en production | 🔄 En cours | Bloquant | 6 offres « (démo) » d'une entreprise fictive ; le script refuse `APP_ENV=production`, une autre cible que le projet de préprod, et toute base contenant des abonnements live. |
| PRE-04 | Cartes Stripe de test documentées | ✅ Terminé et testé | Bloquant | `docs/STRIPE_TESTING.md`, section 3. |

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
