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

### Tests exécutés
- Appel `GET /v1/account` à l'API Stripe (mode test) : réussi.
- Référence avant modifications : typage, lint, 112 tests unitaires, 45 tests d'intégration verts ; `npm audit --omit=dev` : avis modérés sur Next.js 16.4.4, puis 0 après passage en 16.4.6.
- Tests unitaires `app-env` : 4/4.
- Stripe réel (mode test), `tests/e2e/stripe-real.spec.ts` : 4/4 après corrections, 116 événements Stripe relayés, tous traités avec le code 200.
- Intégration : 46/46 (dont le nouveau test d'ordre des événements).
- Unitaires : 118/118 (dont configuration AdSense et `APP_ENV`).
- E2E complets sur build de production (identifiant AdSense factice, publicité désactivée par défaut) : 39/39, dont publicité 2/2 et accessibilité 6/6 ; les 4 parcours Stripe réels sont lancés séparément (4/4).

### Constat sur l'environnement de test
- Le proxy de la session injecte la clé secrète Stripe dans toutes les requêtes vers `api.stripe.com`, y compris celles du navigateur. Stripe refuse alors la saisie de carte sur Checkout. La saisie de carte et le défi 3D Secure sur la page Stripe sont donc à vérifier à la main en préprod.
