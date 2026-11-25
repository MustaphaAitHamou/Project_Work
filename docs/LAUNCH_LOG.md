# Journal de lancement — Tamurt Jobs

Modifications, tests exécutés et décisions, du plus récent au plus ancien. Les statuts sont tenus dans [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

## 25 novembre 2026

### Décisions et constats
- Branche de travail `claude/jobs-lancement`, créée depuis `claude/jobs-inscription-anonymat` (526eddc). `main` reste intouchée jusqu'à l'accord du propriétaire.
- Publicité : le produit adapté est **Google AdSense**. Google Ads sert à acheter de la publicité ; Ad Manager s'adresse aux régies et gros éditeurs. Google exige une CMP certifiée intégrée au TCF pour l'EEE et le Royaume-Uni (depuis le 16/01/2024) et pour la Suisse (depuis le 31/07/2024). Sources : aide AdSense, articles 13554116 et 14893312.
- `ads.txt` : Google commence par le domaine racine. Si Jobs est en sous-domaine, le domaine racine doit servir `ads.txt` ou rediriger vers celui de Jobs (aide AdSense, article 9785052).
- Hébergement : Vercel Hobby est réservé à un usage non commercial, et ses tâches planifiées (Cron Jobs) ne tournent qu'une fois par jour. Il faut donc Vercel Pro. Supabase gratuit met en pause après une semaine d'inactivité et n'a pas de sauvegarde automatique : Supabase Pro pour la production.
- Stripe : la clé de test est fournie par formulaire sécurisé et injectée par le proxy de la session. Le compte de test (« environnement de test Tamurt Jobs ») est rattaché à la **France** : l'entité titulaire du compte live est à confirmer, car les textes nomment Tamurt Services LLC.

### Modifications
- Création de cette checklist et de ce journal.
- `APP_ENV` (préprod distincte de la prod pour Vercel), en-tête `noindex` hors production, mot de passe HTTP Basic optionnel pour la préprod, bandeau « Préproduction » (4 langues). Next.js 16.4.6 (avis de sécurité de 16.4.4).
- Stripe :
  - conversion de devise automatique désactivée à chaque session Checkout (le test réel affichait 6,77 $US au lieu de 5,95 €) ;
  - rattachement de l'abonnement avant d'enregistrer une facture arrivée trop tôt (le test réel a perdu le lien entre le premier paiement et l'annonce) ;
  - motif réel des refus de paiement (code de refus de la carte au lieu d'un code générique) ;
  - client HTTP « fetch » optionnel (`STRIPE_HTTP_CLIENT=fetch`) pour passer par un proxy.
- `scripts/stripe-forward-events.mjs` : relais des vrais événements Stripe de test vers un webhook local.
- `tests/e2e/stripe-real.spec.ts` (4 parcours réels) et `tests/integration/db/stripe-webhook-order.test.ts`.
- `docs/STRIPE_TESTING.md` : tests, configuration Stripe, cartes de test, passage en live.
- Publicité AdSense :
  - 5 emplacements publics étiquetés, place réservée, chargement à l'approche de l'écran, emplacement masqué s'il n'est pas rempli ;
  - CMP certifiée de Google et lien « Paramètres des cookies » ;
  - interrupteur `ads.enabled` et identifiants `ads.slots` dans les paramètres du back-office (migration `20261125090000_ads_settings.sql`) ;
  - `ads.txt` et balise de vérification générés depuis `NEXT_PUBLIC_ADSENSE_CLIENT` ;
  - CSP ouverte aux domaines Google seulement dans ce cas ;
  - textes cookies et confidentialité (FR, EN) mis à jour, avec passages `[À VALIDER]` ;
  - `docs/ADSENSE.md`.
- `docs/RECETTE.md` (recette manuelle) et modèle GitHub « Bug de recette ».
- Double authentification du back-office : migration `20261125100000_admin_mfa.sql` (aal2 exigé par `app.has_permission` et `app.is_admin`, réglage `security.admin_mfa_required`), page `/[locale]/admin-security` (enrôlement par QR code ou clé, vérification à chaque connexion), garde `requirePermission`, textes en 4 langues ; TOTP activé dans `supabase/config.toml` ; `seed.sql` le désactive en local et en CI uniquement.
- `scripts/preprod-seed.mjs` : comptes de recette et données de démonstration, avec garde-fous anti-production.
- `docs/RUNBOOK.md` (sauvegardes, rollback, surveillance, incidents) ; `docs/DEPLOYMENT.md` mis à jour (deux projets Vercel, `APP_ENV`, `PREPROD_BASIC_AUTH`, `NEXT_PUBLIC_ADSENSE_CLIENT`, double authentification).
- Signalements (DSA, art. 16, § 5) : l'auteur reçoit un e-mail de décision (traité ou classé), dans sa langue (migration `20261125110000_report_decision_notice.sql`, colonne `reporter_locale`, modèle `report_decision` en 4 langues). CGU FR et EN mises à jour.
- Aperçu réseaux sociaux (image 1200 × 630), `docs/COMPLIANCE_LAUNCH.md` (lancement France seule proposé, questions pour le juriste, proposition de remboursement).
- Stabilité visuelle : décalage de mise en page de l'accueil mesuré à 0,23–0,24 sur mobile lent, causé par l'arrivée tardive des polices (Bitter, puis Noto Serif en `swap`). Les trois polices passent en `display: optional` : CLS 0,000 sur toutes les pages mesurées ; Bitter s'affiche toujours dans les conditions normales (vérifié). `scripts/measure-web-vitals.mjs` garde la mesure.
- Surveillance des erreurs : `@sentry/nextjs` 11.11.0 (version de plus de deux semaines), activée seulement avec `NEXT_PUBLIC_SENTRY_DSN`. Aucune identité, aucun cookie, en-tête, corps de requête ni paramètre d'URL n'est envoyé (`dataCollection`, `scrubEvent`). Tunnel `/monitoring` sur le domaine (CSP inchangée), exclu du proxy. Test d'envoi : `/api/health?monitoring=test` avec le secret des tâches planifiées. Politique de confidentialité mise à jour.
- Portail client Stripe : aucune configuration n'existait en mode test, donc le bouton « Gérer le paiement et les factures » aurait échoué. Nouveau script `scripts/stripe-setup-portal.mjs`, idempotent, qui refuse une clé live sans `--live` ; configuration créée en mode test, et devenue la configuration par défaut.
- Paiement et portail : une erreur de l'API Stripe (service injoignable, requête refusée, portail absent) affichait une page d'erreur. Elle donne maintenant « Une erreur est survenue. Réessayez. » et est journalisée sans donnée personnelle : type, code, statut et identifiant de requête Stripe, sans le texte de l'erreur, qui peut citer une adresse e-mail.
- Sentry :
  - les erreurs du navigateur étaient classées en `development` même en production : l'environnement est maintenant transmis au navigateur au moment du build (`NEXT_PUBLIC_APP_ENV`) ;
  - le SDK envoyait une « session » à chaque page vue : désactivé, seules les erreurs sont envoyées.
- `/api/health` : en production, la réponse publique ne dit plus quels services sont configurés (mode Stripe, fournisseur d'e-mail, anti-robot). Le détail reste dans le back-office et avec le secret des tâches planifiées. `docs/RUNBOOK.md` et `docs/STRIPE_TESTING.md` sont adaptés.
- `.env.example` : variables `PREPROD_BASIC_AUTH`, `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`, `STRIPE_HTTP_CLIENT` et explication d'`APP_ENV`.
- `docs/DEPLOYMENT.md` : l'activation du compte Stripe live ne présume plus de l'entité vendeuse, qui est à confirmer.
- Relais local des événements Stripe (`scripts/stripe-forward-events.mjs`, outil de développement) : il manquait parfois un événement (`invoice.payment_failed`) créé dans la même seconde que son curseur. Il relit maintenant une fenêtre de deux minutes à chaque passage et ignore les doublons. La préprod et la production reçoivent les webhooks directement de Stripe et ne sont pas concernées.

### Tests exécutés
- Appel `GET /v1/account` à l'API Stripe (mode test) : réussi.
- Référence avant modifications : typage, lint, 112 tests unitaires, 45 tests d'intégration verts ; `npm audit --omit=dev` : avis modérés sur Next.js 16.4.4, puis 0 après passage en 16.4.6.
- Tests unitaires `app-env` : 4/4.
- Stripe réel (mode test), `tests/e2e/stripe-real.spec.ts` : 4/4 après corrections, 116 événements Stripe relayés, tous traités avec le code 200.
- Intégration : 46/46 (dont le nouveau test d'ordre des événements).
- Unitaires : 118/118 (dont configuration AdSense et `APP_ENV`).
- E2E complets sur build de production (identifiant AdSense factice, publicité désactivée par défaut) : 39/39, dont publicité 2/2 et accessibilité 6/6 ; les 4 parcours Stripe réels sont lancés séparément (4/4).
- Après la double authentification : intégration 48/48, E2E 40/40 (dont `admin-mfa`), générateur TOTP conforme aux vecteurs de la RFC 6238.
- `scripts/preprod-seed.mjs` en local : 6 comptes et 6 offres de démonstration ; garde-fous vérifiés (mauvaise cible et `APP_ENV=production` refusés).
- Après l'avis de décision des signalements : unitaires 119/119, intégration 49/49.
- Mesures mobiles (Pixel 7, CPU ×4, 4G lente, build de production locale) : LCP 0,8–1,0 s ; CLS de l'accueil 0,225 → 0,000 après correction ; recherche, entreprises et fiche d'offre à 0,000. E2E 40/40 après la correction. (L'audit Lighthouse via `npx` a été refusé par le contrôle de sécurité de la session : mesures faites avec Playwright.)
- Build avec DSN Sentry et identifiant AdSense factices : réussi ; `/api/health` indique la surveillance configurée ; réécriture du tunnel `/monitoring` présente (l'hôte factice est injoignable depuis la session, d'où une réponse 500 attendue) ; E2E 40/40.
- Après les corrections Stripe, Sentry et santé :
  - unitaires 127/127, dont 5 nouveaux sur les erreurs Stripe et 3 sur `/api/health` ;
  - intégration 49/49 ; typage et lint verts.
- E2E sur le build de préproduction (`APP_ENV=preprod`, identifiant AdSense et DSN Sentry factices) : 40/40.
  - Premier passage avec une clé Stripe sur le serveur : deux échecs attendus (« Paiement indisponible », garde de renouvellement), car ces tests supposent un serveur sans clé.
  - Repassés sur un serveur sans clé : verts.
  - Publicité 2/2, avec l'identifiant AdSense du build.
- Stripe réel (mode test) : 5/5, dont le nouveau parcours du portail client (deux annonces, résiliation de l'une, renouvellement de l'autre).
  - Un premier passage a échoué : l'événement `invoice.payment_failed` avait bien été émis par Stripe mais pas relayé (défaut du relais local, corrigé).
  - Second passage : 133 événements relayés, tous acceptés.
- Build de préproduction : environnement `preprod` présent dans le code du navigateur ; aucun envoi au tunnel `/monitoring` sur trois pages vues (avant : un envoi de session par page).
- Le portail Stripe s'ouvre (billing.stripe.com), mais son écran ne s'affiche pas dans cette session : ses fichiers viennent de `a300.stripecdn.com`, bloqué par le réseau de la session. Écran à vérifier en préprod (R-11, R-12).

### Constat sur l'environnement de test
- Le proxy de la session injecte la clé secrète Stripe dans toutes les requêtes vers `api.stripe.com`, y compris celles du navigateur. Stripe refuse alors la saisie de carte sur Checkout. La saisie de carte et le défi 3D Secure sur la page Stripe sont donc à vérifier à la main en préprod.

## 25 novembre 2026 (après-midi) — production sur Iglao

### Décisions du propriétaire
- Architecture définitive :
  - GitHub pour le code, Vercel pour la **préproduction seulement**, **Iglao pour la production** ;
  - Supabase, Stripe, Resend et AdSense.
- Lancement public visé le **30 novembre**, sous conditions.

### Constats
- **Iglao** : hébergeur français (cPanel, Plesk, VPS Linux KVM, centres de données en France). Aucune offre publique ne mentionne Node.js.
  - Recommandation : un VPS Linux de 4 Go de RAM au moins.
  - À confirmer avec Iglao : sauvegardes ou instantanés, IPv6, comportement de l'anti-DDoS avec les webhooks.
  - Ses coordonnées légales n'ont pas été trouvées : marquées `[À COMPLÉTER]`.
- **Vercel Hobby** : usage non commercial seulement, et les tâches planifiées plus fréquentes qu'une fois par jour font échouer le déploiement. La préprod d'un produit commercial relève donc de Pro (20 $/mois). Décision du propriétaire, rien n'est souscrit.

### Modifications
- **Serveur autonome** (`NEXT_OUTPUT=standalone`) et `scripts/package-standalone.sh`. La construction n'a plus besoin d'aucun secret :
  - `robots.txt`, le plan du site et le client public de Supabase lisent seulement les réglages publics (`publicEnv`) ;
  - avant, la construction exigeait la clé secrète de Supabase.
- **`deploy/iglao/`** :
  - Nginx (HTTPS, en-têtes, fichiers statiques, rejet des noms d'hôte inconnus) ;
  - service systemd durci ;
  - cron ;
  - `deploy.sh` : bascule, vérification de santé, retour automatique, refus des archives contenant un `.env` ;
  - `rollback.sh` ;
  - `run-cron.sh` ;
  - modèle de configuration ;
  - procédure complète.
- **Workflows GitHub** :
  - `ci.yml` réutilisable ;
  - `preprod-vercel.yml` : CI, puis déploiement Vercel ; les déploiements automatiques de Vercel sont coupés dans `vercel.json` ;
  - `deploy-iglao.yml` : manuel depuis `main`, confirmation saisie, CI complète, approbation de l'environnement `production`, puis vérification publique.
- **Adresse du visiteur derrière Nginx** : `CLIENT_IP_HEADER=x-real-ip`. Un `X-Forwarded-For` forgé est ignoré. Le tableau de bord signale l'absence de ce réglage en production autohébergée.
- **Publicité par environnement** (`ADS_MODE`) :
  - hors production, emplacements de test étiquetés, sans aucune requête à Google ;
  - annonces de test AdSense en option ;
  - annonces réelles réservées à la production.
- **Textes juridiques** : Iglao comme hébergeur, Resend comme sous-traitant, avec les mentions à compléter.
- **Documentation** :
  - `docs/EMAIL.md` (Resend, DNS, Supabase) ;
  - `docs/DEPLOYMENT.md` et `docs/RUNBOOK.md` réécrits pour Vercel en préproduction et Iglao en production ;
  - `.env.example`.

### Défauts trouvés en rejouant la procédure du VPS, tous corrigés
La simulation reproduit le VPS dans un conteneur Ubuntu 24.04 : Nginx 1.24 avec des processus `www-data`, utilisateur `tamurt`, `/srv/tamurt-jobs`, `deploy.sh`.
1. **Toutes les connexions et confirmations d'e-mail en 502** : les cookies de session de Supabase dépassaient les tampons par défaut de Nginx (« upstream sent too big header »). Tampons agrandis dans les deux sens.
2. **Actions serveur refusées** (« Invalid Server Actions request ») : Nginx transmettait l'hôte sans son port. Il transmet désormais l'hôte exact (`$http_host`), et un serveur par défaut rejette les autres noms.
3. **Déconnexion et lien de confirmation d'e-mail** : ils redirigeaient vers l'adresse interne de Node.js (`http://…:3000`). Ce sont maintenant des redirections relatives (`redirectToPath`).
4. **Pages sans leurs scripts** : `useradd` crée `/srv/tamurt-jobs` en 750, illisible par Nginx. Ajouté `chmod 755` à la procédure.
5. **Tâches planifiées en échec** : dossier d'état dans `/run`, interdit en écriture à l'utilisateur `tamurt`. Il est déplacé dans `shared/cron`.
6. **Retour arrière risqué** : une version en échec restait dans `releases/` et aurait été choisie comme « précédente ». Elle est désormais rangée dans `failed/`, et `rollback.sh` revient à son point de départ si la cible ne répond pas.

Aussi :
- en-tête `Cache-Control` doublé sur les fichiers statiques, corrigé ;
- `http2 on;` refusé par le Nginx d'Ubuntu 24.04, remplacé par `listen … http2`.

### Faille de sécurité corrigée
- Avant le chargement du JavaScript (connexion lente), les formulaires partageaient un défaut : connexion, inscription, mot de passe et une vingtaine d'autres partaient en **GET**, avec tous les champs dans l'adresse.
- Le mot de passe se retrouvait alors dans l'historique et dans les journaux du serveur. Constaté dans les journaux de Nginx (`/fr/login?email=…&password=…`).
- Correctif : méthode POST, et boutons d'envoi désactivés tant que la page n'est pas prête (`useSyncExternalStore`).

### Tests exécutés
- Construction du serveur autonome **sans** `.env.local` ni secret : réussie (30 Mo).
  - L'archive contient les textes juridiques et le module d'images natif Linux x64, et aucun `.env`.
- `nginx -t` sur les deux configurations.
- E2E à travers Nginx sur le serveur autonome déployé par `deploy.sh` : **43/43**. Le test des adresses IP autorisées vérifie, derrière Nginx, qu'un en-tête forgé est refusé.
- `run-cron.sh` (maintenance, e-mails, alertes) en tant que `tamurt` : HTTP 200.
- Retours arrière :
  - `rollback.sh` vers la version précédente, puis vers une version donnée ;
  - une version cassée revient seule à la précédente (le site reste en ligne) ;
  - une archive contenant un `.env` est refusée.
- Charge (`scripts/load-test.mjs`, à travers Nginx, 4 vCPU, base sur la même machine) :
  - 5 visiteurs simultanés : médiane 110 ms, p95 160 ms, 49 req/s ;
  - 20 visiteurs : 41 req/s, 0 erreur ;
  - mémoire de l'application : environ 830 Mo.
- Migrations sur une base **vierge, sans seed** : 25 migrations dans l'ordre, sans erreur.
  - Aucun compte, aucune entreprise, aucune offre, aucun administrateur.
  - Publication payante fermée partout, tarif de référence présent, publicité désactivée, double authentification du back-office exigée.
- `supabase db lint` : aucune erreur. Types générés à jour.
- Unitaires 131/131, intégration 49/49, typage et lint verts.
