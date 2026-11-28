# E-mails transactionnels — Resend

## 1. Deux circuits d'envoi

| Circuit | E-mails | Envoyés par | Réglage |
| --- | --- | --- | --- |
| Authentification | confirmation d'inscription, réinitialisation du mot de passe, changement d'adresse | Supabase Auth, par SMTP | Supabase → Authentication → **SMTP Settings** et **Emails** (modèles) |
| Application | candidature envoyée, nouvelle candidature, changement de statut, alertes emploi, vérification de l'entreprise, modération, annonce publiée, échec de paiement, suspension pour impayé, expiration, suspension de compte, dévoilement d'identité, décision sur un signalement, demandes RGPD | Tamurt Jobs (file `email_outbox`), par l'API Resend | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` |

Les deux circuits utilisent le même domaine d'envoi et la même clé Resend.

- Les e-mails d'application sont mis en file dans la même transaction que l'action qui les déclenche, envoyés juste après la réponse, puis repris toutes les 10 minutes en cas d'échec (`/api/cron/emails`).
- Les modèles sont dans les quatre langues (`messages/*.json`, clés `emails.*`) et personnalisables depuis le back-office (E-mails).
- Les reçus et factures de paiement sont envoyés par Stripe (réglage du tableau de bord Stripe, voir `STRIPE_TESTING.md`).

## 2. Configurer Resend (à faire par le propriétaire)

1. Compte sur [resend.com](https://resend.com).
2. **Domains → Add domain.** Utiliser le domaine de production, par exemple `jobs.<domaine>` ; un sous-domaine dédié protège la réputation du domaine principal. Région : **EU (Irlande)**.
3. Copier chez le gestionnaire DNS **exactement** les enregistrements de l'onglet *Records* du domaine :
   - DKIM : enregistrement TXT `resend._domainkey` ;
   - SPF : enregistrements MX et TXT sur le sous-domaine `send` (ou CNAME pour les domaines créés après août 2026, selon ce qu'affiche Resend).
4. Attendre la vérification : en général 15 minutes, jusqu'à 72 heures.
5. Après vérification, ajouter DMARC (enregistrement TXT `_dmarc.<domaine>`). Commencer en observation :

```
v=DMARC1; p=none; rua=mailto:<adresse-de-suivi>
```

   Passer ensuite à `p=quarantine` quand les rapports sont propres.
6. **API Keys → Create API key** : droit *Sending access*, limité au domaine. Cette clé n'est affichée qu'une fois. La saisir **directement** dans les trois endroits ci-dessous, sans la copier ailleurs.

| Où | Champ | Valeur |
| --- | --- | --- |
| Vercel (préproduction) → Settings → Environment Variables | `RESEND_API_KEY` (Sensitive) | la clé |
| Serveur Iglao → `/etc/tamurt-jobs/env` | `RESEND_API_KEY` | la clé |
| Supabase (chaque projet) → Authentication → SMTP Settings | Host `smtp.resend.com`, Port `465`, Username `resend`, Password = la clé, Sender `no-reply@<domaine>`, Sender name `Tamurt Jobs` | |

Variables à côté de la clé : `EMAIL_PROVIDER=resend` et `EMAIL_FROM="Tamurt Jobs <no-reply@<domaine>>"`. `EMAIL_REPLY_TO` est facultatif (adresse de support).

Pour que je puisse tester l'envoi réel depuis cette session, la même clé est demandée par le formulaire sécurisé pour l'hôte `api.resend.com`.

**Préproduction sans domaine vérifié.** Resend n'envoie alors que depuis `onboarding@resend.dev` et vers l'adresse du titulaire du compte. Ça suffit pour une recette par une seule personne, pas pour tester l'inscription d'autres adresses.

## 3. E-mails d'authentification Supabase

### 3.1 Modèles (état au 28/11)

| Modèle Supabase | Fichier | Utilisé par Tamurt Jobs | Préproduction aujourd'hui |
| --- | --- | --- | --- |
| Confirm signup | `confirmation.html` | inscription, renvoi de confirmation | modèle par défaut de Supabase (anglais) |
| Reset password | `recovery.html` | mot de passe oublié, changement de mot de passe | idem |
| Change email address | `email_change.html` | changement d'adresse (confirmé depuis l'ancienne **et** la nouvelle) | idem |
| Reauthentication | `reauthentication.html` | code pour une opération sensible | idem |
| Magic link, Invite user | `magic_link.html`, `invite.html` | non utilisés (prêts au cas où) | idem |
| Notifications : Password changed, Email address changed, MFA method added / removed | `*_notification.html` | alertes de sécurité | **désactivées** |

- Les 10 modèles sont générés par `node scripts/generate-auth-email-templates.mjs` (texte, mise en page, 4 langues, objets dans `supabase/templates/subjects.json`) à l'identité Tamurt Jobs : bandeau bleu nuit, filet jaune, bouton bleu roi, sans image ni police externe.
- **Langue** : lue dans le profil (`locale`, enregistrée à l'inscription et dans les paramètres), français si absente. L'objet est traduit aussi.
- **Liens** : `{{ .SiteURL }}/auth/confirm?token_hash=…&type=…&locale=…`. La page ouverte demande **un clic** avant d'utiliser le jeton à usage unique : les filtres de messagerie (Microsoft Defender Safe Links, antivirus) qui ouvrent les liens avant la personne ne le consomment plus. Redirections : inscription → espace candidat ou création d'entreprise (recruteur) ; mot de passe → page « nouveau mot de passe » ; lien expiré ou déjà utilisé → connexion avec un message clair.
- **Vérifié** (`tests/integration/auth/auth-email-templates.test.ts`, vrai serveur Auth local + boîte de test) : chaque modèle déclenché pour de vrai, langue (dont l'arabe de droite à gauche et le français par défaut), objet, identité, lien et type, aucune variable non remplie.

### 3.2 Appliquer les modèles en préproduction puis en production

**Option A (recommandée) : jeton temporaire, 2 minutes.**
1. Supabase → avatar → **Account preferences → Access Tokens → Generate new token**. Nom `tamurt-templates-temp`, **expiration 1 jour**, permissions : *Auth* en lecture-écriture **et** *Project admin* en écriture, **limitées au projet `tamurt-jobs-preprod`**.
2. Me le transmettre par le formulaire sécurisé (jamais dans la conversation). Je lance :
   `node scripts/supabase-auth-config.mjs --project-ref <ref> --site-url https://tamurt-jobs-preprod.vercel.app --templates-only`
   Le script ne touche qu'aux e-mails (ni captcha, ni SMTP, ni URL), puis relit et compare.
3. Révoquer le jeton aussitôt après.

**Option B : à la main** (10 modèles, environ 15 minutes). Supabase → projet → **Authentication → Emails**.
1. Onglet **Templates**. Pour *Confirm signup*, *Invite user*, *Magic Link*, *Change Email Address*, *Reset Password*, *Reauthentication* :
   - **Subject** : la valeur correspondante de `supabase/templates/subjects.json`, entre les guillemets, à recopier telle quelle (elle commence par `{{ $l := "fr" }}`) ;
   - **Body** (onglet *Source*) : tout le contenu du fichier `.html` correspondant ;
   - **Save**.
2. Onglet des notifications de sécurité : activer *Password changed*, *Email address changed*, *MFA method added*, *MFA method removed*, avec les fichiers `*_notification.html` et leurs objets (`password_changed_notification`, etc.).
3. Contrôle : demander « Mot de passe oublié » pour un compte de recette dont vous lisez la boîte. Objet attendu : « Réinitialisez votre mot de passe · Tamurt Jobs ».

### 3.3 Autres réglages Supabase (Authentication)

| Réglage | Préproduction (constaté le 28/11) | À faire |
| --- | --- | --- |
| URL Configuration → Site URL / Redirect URLs | `https://tamurt-jobs-preprod.vercel.app` (+ `/**`) | production : `https://tamurtjobs.com` et `https://tamurtjobs.com/**` |
| Attack Protection → Captcha | activé (Turnstile) | garder ; même clé secrète que `TURNSTILE_SECRET_KEY` |
| Emails → **SMTP Settings** | **non configuré** : Supabase n'envoie qu'aux membres de l'équipe, 2 e-mails par heure. L'inscription d'une adresse extérieure échoue | configurer Resend (3.4) **avant l'ouverture** |
| Rate Limits → e-mails envoyés par heure | 2 | 100 après le SMTP Resend (ajuster au trafic) |
| Confirm email, mot de passe 10 caractères (minuscules, majuscules, chiffres), TOTP | conformes | — |

### 3.4 SMTP Resend dans Supabase

Supabase → **Authentication → Emails → SMTP Settings → Enable Custom SMTP** :

| Champ | Valeur |
| --- | --- |
| Sender email | `no-reply@<domaine vérifié dans Resend>` |
| Sender name | `Tamurt Jobs` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | une clé API Resend (*Sending access*, limitée au domaine), saisie **uniquement** dans ce champ |

Puis **Rate Limits** → e-mails par heure : 100. Tester avec « Mot de passe oublié » sur un compte de recette dont vous lisez la boîte.

### 3.5 DNS nécessaires (domaine d'envoi)

À créer chez le gestionnaire DNS de `tamurtjobs.com`, **avec les valeurs exactes affichées par Resend** (Domains → le domaine → Records) :

| Type | Nom | Rôle |
| --- | --- | --- |
| TXT | `resend._domainkey` (ou `resend._domainkey.<sous-domaine>`) | DKIM : signature des e-mails |
| MX | `send` (ou `send.<sous-domaine>`) | SPF / retours de Resend |
| TXT | `send` (ou `send.<sous-domaine>`) | SPF (`v=spf1 include:… ~all`, valeur donnée par Resend) |
| TXT | `_dmarc` | DMARC, d'abord `v=DMARC1; p=none; rua=mailto:<adresse de suivi>`, puis `p=quarantine` quand les rapports sont propres |

Conseil : un sous-domaine dédié (par exemple `notifications.tamurtjobs.com`) protège la réputation du domaine principal. Aucun enregistrement n'est encore créé ; c'est à faire par le propriétaire du domaine.

## 4. Ce qui est vérifié

| Vérification | Comment | État |
| --- | --- | --- |
| Lien de confirmation d'inscription reçu et fonctionnel, y compris quand un filtre de messagerie ouvre le lien d'abord | E2E « a new address leads to the e-mail check, and the link confirms the account », avec la boîte de test locale (Mailpit) | ✅ automatique |
| Les 10 modèles d'authentification (langue, identité, liens, alertes de sécurité) | `tests/integration/auth/auth-email-templates.test.ts` | ✅ automatique (local) ; préproduction : modèles à appliquer (3.2) |
| Réinitialisation du mot de passe de bout en bout | E2E `recette` (Mailpit) ; en préproduction après SMTP | ✅ local, ⏳ préproduction |
| Aucun envoi réel vers les adresses de test (`@example.test`, etc.) | test unitaire `email-provider` | ✅ automatique |
| E-mails de l'application : rendu, langue, liens absolus vers le site | tests unitaires `email-render`, E2E du back-office (personnalisation, restauration) | ✅ automatique |
| File d'envoi, reprise après échec | tests d'intégration et tâche planifiée `emails` | ✅ automatique |
| Délivrabilité réelle (SPF, DKIM, DMARC, indésirables) | envoi réel vers une boîte Gmail et une boîte Outlook, puis contrôle des en-têtes `spf=pass`, `dkim=pass`, `dmarc=pass` | ⏳ dès que le domaine et la clé Resend existent |
