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

### Tests exécutés
- Appel `GET /v1/account` à l'API Stripe (mode test) : réussi.
