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

## 3. Réglages d'authentification Supabase (chaque projet)

| Réglage (Authentication) | Préproduction | Production |
| --- | --- | --- |
| URL Configuration → Site URL | `https://preprod.<domaine>` | `https://<domaine>` |
| URL Configuration → Redirect URLs | `https://preprod.<domaine>/**` | `https://<domaine>/**` |
| Emails → Confirm email | activé | activé |
| Emails → modèles *Confirm signup*, *Reset password*, *Change email address* | contenu de `supabase/templates/*.html`, sujets de `supabase/config.toml` | idem |
| Multi-Factor → TOTP | activé (back-office) | activé |
| Rate limits → e-mails par heure | 30 au moins (préproduction) | selon le trafic (le SMTP Resend lève la limite par défaut) |

- Les liens des modèles pointent vers `{{ .SiteURL }}/auth/confirm?token_hash=…`. Ils fonctionnent même si l'e-mail est ouvert sur un autre appareil, et ramènent la personne dans sa langue.
- `scripts/supabase-auth-config.mjs` applique ces réglages et les trois modèles par l'API.
  - Il exige un jeton portant **deux** permissions, `auth_config_write` **et** `project_admin_write`. Cette dernière est large : elle permet aussi de mettre en pause, restaurer ou supprimer le projet. Constaté le 26/11 : un jeton « Auth » seul est refusé.
  - Sinon, saisir les réglages à la main dans le tableau de bord (tableau ci-dessus).
  - Le mot de passe SMTP reste saisi par toi dans le tableau de bord.

## 4. Ce qui est vérifié

| Vérification | Comment | État |
| --- | --- | --- |
| Lien de confirmation d'inscription reçu et fonctionnel | E2E « a new address leads to the e-mail check, and the link confirms the account », avec la boîte de test locale (Mailpit) | ✅ automatique |
| Réinitialisation du mot de passe | recette manuelle C-03 | en préprod |
| E-mails de l'application : rendu, langue, liens absolus vers le site | tests unitaires `email-render`, E2E du back-office (personnalisation, restauration) | ✅ automatique |
| File d'envoi, reprise après échec | tests d'intégration et tâche planifiée `emails` | ✅ automatique |
| Délivrabilité réelle (SPF, DKIM, DMARC, indésirables) | envoi réel vers une boîte Gmail et une boîte Outlook, puis contrôle des en-têtes `spf=pass`, `dkim=pass`, `dmarc=pass` | ⏳ dès que le domaine et la clé Resend existent |
