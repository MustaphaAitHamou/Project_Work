# Plan de production — Iglao et tamurtjobs.com

> **Plan seulement.** Rien n'a été commandé, déployé ni publié. Chaque étape marquée « toi » est
> une décision ou une action du propriétaire. La mise en ligne publique et les paiements réels
> n'auront lieu qu'après ton accord explicite (GO / NO GO, § 12).

Guides détaillés auxquels ce plan renvoie :
- serveur : [deploy/iglao/README.md](../deploy/iglao/README.md) ;
- variables : [DEPLOYMENT.md](DEPLOYMENT.md) ;
- e-mails : [EMAIL.md](EMAIL.md) ;
- exploitation : [RUNBOOK.md](RUNBOOK.md) ;
- conformité : [COMPLIANCE_LAUNCH.md](COMPLIANCE_LAUNCH.md) et [COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md) ;
- suivi : [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

## 0. Architecture cible

```
tamurtjobs.com (DNS) ──> VPS Iglao : Nginx (HTTPS Let's Encrypt) ──> Node.js 22 (systemd)
                                         │                               ├──> Supabase PRODUCTION (UE) : base, comptes, fichiers
                                         └── cron (tâches planifiées)    ├──> Stripe live (après ton accord)
                                                                         ├──> Resend (e-mails, domaine tamurtjobs.com)
                                                                         └──> Cloudflare Turnstile, Sentry, Google AdSense
```

- Le VPS ne garde **aucune donnée métier** : il se reconstruit à tout moment depuis le dépôt.
- La préproduction (Vercel, Supabase de préproduction, Stripe test) reste **séparée** : aucune
  donnée, clé ni compte n'est partagé avec la production.

## 1. Serveur et environnement (Iglao)

| Élément | Prêt dans le dépôt | À faire |
|---|---|---|
| Offre | Besoin mesuré : environ 830 Mo de mémoire sous charge | **Toi** : VPS Linux KVM, 2 vCPU et 4 Go de RAM au minimum, 40 Go de disque, Ubuntu 24.04 LTS, IPv4 dédiée. Pas d'hébergement mutualisé (Node.js permanent, cron, webhooks). |
| Questions à Iglao | — | **Toi** : sauvegardes ou instantanés du VPS, IPv6, protection anti-DDoS compatible avec les webhooks Stripe, coordonnées de l'hébergeur pour les mentions légales (ACC-24). |
| Préparation du serveur | Procédure complète (§ 3 du guide), utilisateur `tamurt` aux droits réduits, service systemd | Exécution sur le VPS (avec toi : accès SSH par clé). |
| Réglages | Modèle `deploy/iglao/env.production.example` : `APP_ENV=production`, `CLIENT_IP_HEADER=x-real-ip` | Remplir `/etc/tamurt-jobs/env` **sur le serveur** (§ 4). |
| Tâches planifiées | `deploy/iglao/cron/tamurt-jobs` : maintenance horaire, e-mails toutes les 10 minutes, alertes | Installation (§ 3). La suspension des annonces non converties au 1er janvier 2027 passe par la maintenance. |
| Vérifié sans VPS | Conteneur Ubuntu 24.04 le 25/11 : construction sans secret, `deploy.sh`, E2E 43/43 à travers Nginx, retours arrière | Sur le vrai VPS : systemd, certbot, pare-feu, performances. |

## 2. DNS et HTTPS (tamurtjobs.com)

Enregistrements à créer chez le registrar du domaine (**toi**) :

| Nom | Type | Valeur | Rôle |
|---|---|---|---|
| `@` | A (et AAAA si IPv6) | IP du VPS Iglao | site |
| `www` | A (et AAAA) ou CNAME → `tamurtjobs.com` | IP du VPS | redirigé vers `tamurtjobs.com` par Nginx |
| `@` | CAA | `0 issue "letsencrypt.org"` | seule Let's Encrypt peut émettre un certificat (recommandé) |
| `resend._domainkey` | TXT | valeur DKIM donnée par Resend | e-mails (§ 8) |
| `send` | MX et TXT (SPF) | valeurs données par Resend | e-mails (§ 8) |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:<boîte de rapports>` puis `p=quarantine` après 2 à 4 semaines | e-mails (§ 8) |
| `@` | MX | fournisseur de la boîte de réception choisie | **décision** : recevoir `support@` et les rapports DMARC (Resend n'héberge pas de boîtes) |
| `@` | TXT | vérification Google Search Console | référencement (facultatif) |

- **HTTPS** : Let's Encrypt (certbot) pour `tamurtjobs.com` **et** `www.tamurtjobs.com`, avec renouvellement automatique. Procédure : guide Iglao, § 5.
- Redirections vérifiées le 28/11 (Nginx 1.24, certificat de test) :
  - HTTP → HTTPS ;
  - `www` → domaine principal, en une seule redirection ;
  - HTTP/2 ;
  - noms d'hôte inconnus refusés.
- **HSTS** : l'application l'envoie déjà (2 ans, `includeSubDomains`). Tout sous-domaine web devra donc être en HTTPS.
- Si Tamurt Jobs devait vivre sur un sous-domaine, `ads.txt` devrait être servi au domaine racine (AdSense).

## 3. Base de données (Supabase production)

| Étape | Outil | Qui |
|---|---|---|
| Créer le projet **production**, région UE (Paris ou Francfort), offre **Pro** : sauvegardes quotidiennes, pas de mise en pause | Tableau de bord Supabase | **Toi** (dépense) |
| Jeton d'accès limité à ce projet, temporaire | Supabase → Account → Access Tokens | **Toi**, puis révocation après usage |
| Appliquer les migrations dans l'ordre, sur base vierge | `scripts/supabase-apply-migrations.mjs` | Moi, avec le jeton |
| Configurer l'authentification : URL du site, redirections, mot de passe de 10 caractères, MFA, anti-robot Turnstile avec la clé **de production**, SMTP Resend | `scripts/supabase-auth-config.mjs` + tableau de bord ; détails dans [EMAIL.md](EMAIL.md) § 3 | Moi, avec le jeton ; toi pour les secrets (formulaires du tableau de bord) |
| Modèles d'e-mails d'authentification (4 langues, identité Tamurt) | `scripts/supabase-auth-config.mjs --templates-only` | Moi, avec le jeton |
| Premier administrateur, puis double authentification obligatoire | `scripts/grant-admin.mjs` ; réglage `security.admin_mfa_required` | Toi (adresse) et moi |
| Ouverture des marchés (publication) | Back-office → Pays : checklist ou dérogation motivée | **Toi** (§ 10) |
| Aucune donnée de démonstration | `scripts/preprod-seed.mjs` refuse `APP_ENV=production` | — |

> État de la préproduction au 28/11 : la publication n'est ouverte dans **aucun** des 9 pays.
> Même pendant la gratuité, un recruteur ne peut publier que dans un pays ouvert depuis le
> back-office. C'est une décision de conformité, à prendre pour la préproduction comme pour la
> production.

## 4. Secrets

Règle : chaque secret est saisi **directement** à sa place (formulaire du fournisseur, fichier du
serveur, secrets GitHub). Jamais dans le dépôt, qui est public, ni dans une conversation. Une
copie est rangée dans un gestionnaire de mots de passe.

| Secret | Où il vit | Qui le crée |
|---|---|---|
| `SUPABASE_SECRET_KEY` (production) | `/etc/tamurt-jobs/env` | Supabase (toi) |
| `STRIPE_SECRET_KEY` (`sk_live_…`) et `STRIPE_WEBHOOK_SECRET` | `/etc/tamurt-jobs/env`, **seulement après ton accord** | Stripe (toi) |
| `RESEND_API_KEY` | `/etc/tamurt-jobs/env` et mot de passe SMTP dans Supabase | Resend (toi) |
| `TURNSTILE_SECRET_KEY` (production) | `/etc/tamurt-jobs/env` et réglage anti-robot de Supabase | Cloudflare (toi) |
| `CRON_SECRET` | `/etc/tamurt-jobs/env` | `openssl rand -hex 32` sur le serveur |
| `IGLAO_SSH_KEY`, `IGLAO_KNOWN_HOSTS` | GitHub → Environments → `production` | toi (clé dédiée au déploiement) |
| Réglages publics `NEXT_PUBLIC_*` (Supabase, Turnstile, AdSense, Sentry) | Variables GitHub `production` : inscrits à la compilation | toi ou moi (non secrets) |

Rotation : en cas de doute, révoquer chez le fournisseur, remplacer à sa place, redémarrer
(`systemctl restart tamurt-jobs`).

## 5. Sauvegardes

| Donnée | Prévu | Écart à combler |
|---|---|---|
| Base (offres, comptes, candidatures) | Supabase Pro : sauvegarde quotidienne, 7 jours | Export manuel **avant l'ouverture** et avant chaque migration risquée ([RUNBOOK.md](RUNBOOK.md) § 2), chiffré, hors dépôt |
| Fichiers (CV, justificatifs, logos) dans Supabase Storage | — | **Point ouvert** : non inclus dans les sauvegardes de la base. Proposition : copie hebdomadaire chiffrée des compartiments vers un stockage tiers (accès compatible S3 de Supabase Storage, à vérifier), en respectant les durées de [DATA_RETENTION.md](DATA_RETENTION.md). Décision et coût : toi. |
| Serveur | Reconstructible depuis le dépôt | Copie de `/etc/tamurt-jobs/env` dans le gestionnaire de mots de passe ; instantané du VPS si Iglao le propose |
| Test de restauration | Procédure écrite | À faire une fois avant l'ouverture (restaurer l'export sur une base de test) |

## 6. Surveillance et alertes

| Quoi | Outil | Alerte vers |
|---|---|---|
| Disponibilité | Sonde HTTPS toutes les 1 à 5 minutes sur `https://tamurtjobs.com/api/health` (503 si la base ne répond pas) ; UptimeRobot ou Better Stack, offres gratuites possibles | e-mail et SMS du propriétaire |
| Expiration du certificat | Même sonde (contrôle du certificat) ; certbot renouvelle seul | e-mail |
| Erreurs de l'application | Sentry (déjà intégré : il suffit du DSN), puis `/api/health?monitoring=test` | e-mail à chaque nouvelle erreur |
| Tâches planifiées | Journal `journalctl -t tamurt-jobs-cron` ; tableau de bord du back-office (file d'e-mails) | contrôle quotidien la première semaine |
| Paiements | Stripe → Webhooks (Stripe prévient seul en cas d'échecs répétés) | e-mail Stripe |
| E-mails | Resend → Logs (rebonds, plaintes) | contrôle quotidien la première semaine |
| Serveur | Espace disque et mémoire (outil d'Iglao s'il existe, sinon `df -h` et `free -m`) | à définir avec Iglao |

## 7. Déploiement

- Workflow **Production (Iglao)** (`.github/workflows/deploy-iglao.yml`) :
  - lancé **à la main** uniquement, en tapant « production » ;
  - bloqué jusqu'à **ton approbation** (environnement GitHub `production`, *Required reviewers*) ;
  - CI complète, puis construction sans secret, envoi, bascule, vérification de `/api/health`.
- Ordre de chaque mise en production :
  1. sauvegarde ;
  2. migrations ;
  3. déploiement ;
  4. vérifications ([RUNBOOK.md](RUNBOOK.md) § 4).
- Retour arrière : `bin/rollback.sh` (version précédente ou donnée). Retour automatique si la nouvelle version ne répond pas.
- Branche : la production se construit depuis `main`, après fusion de `claude/jobs-lancement` (ACC-14, ton accord).
- La préproduction suit son propre chemin automatique ([DEPLOYMENT_PREPROD.md](DEPLOYMENT_PREPROD.md)).

## 8. E-mails transactionnels

| Étape | Détail | Qui |
|---|---|---|
| Domaine d'envoi `tamurtjobs.com` dans Resend | DKIM, MX et SPF sur `send`, puis DMARC (§ 2) | Toi (DNS) |
| Clé API Resend | `/etc/tamurt-jobs/env` : `EMAIL_PROVIDER=resend`, `EMAIL_FROM="Tamurt Jobs <no-reply@tamurtjobs.com>"`, `EMAIL_REPLY_TO=support@tamurtjobs.com` | Toi |
| SMTP de Supabase via Resend | `smtp.resend.com`, port 465, utilisateur `resend` ; quota d'envoi relevé ensuite | Toi (formulaire Supabase) |
| Modèles | 10 modèles d'authentification et e-mails applicatifs, en 4 langues, identité Tamurt (vérifiés en local) | Prêt |
| Premier envoi réel | **Uniquement vers une adresse à toi, avec ton accord** | Toi et moi |

Garde-fou déjà en place : la file d'envoi de l'application n'envoie jamais par Resend vers une
adresse réservée aux tests (`example.com`, `.test`…). Elle marque ces messages « annulés ». Les
e-mails d'authentification, eux, partent du SMTP de Supabase.

## 9. Sécurité

| Couche | En place | À faire sur le VPS ou par toi |
|---|---|---|
| Serveur | Service systemd aux droits réduits ; Nginx refuse les hôtes inconnus ; mises à jour automatiques | SSH par clé uniquement, connexion root et mot de passe désactivés ; pare-feu (`ufw`) : 22 (si possible limité), 80, 443 ; `fail2ban` |
| Application | En-têtes de sécurité (CSP, HSTS…), RLS sur toutes les tables (tests), limites de débit, Turnstile sur tous les formulaires sensibles, captcha Supabase, candidatures anonymes | — |
| Comptes | Mots de passe de 10 caractères au moins ; MFA obligatoire au back-office ; rôles séparés (modération, finance, données personnelles) | Activer la MFA sur **tes** comptes Supabase, Stripe, Resend, Cloudflare, GitHub, Iglao et du registrar |
| Dépôt | Aucun secret versionné ; secrets GitHub limités par environnement | **Recommandé** : repasser le dépôt en privé avant l'ouverture (ACC-20). Il est public aujourd'hui. |
| Données | Durées de conservation ([DATA_RETENTION.md](DATA_RETENTION.md)), export et effacement, journal d'audit | Analyse d'impact si le conseil la juge nécessaire |

## 10. Obligations juridiques et conformité (9 pays)

> Synthèse de travail. **Aucun texte n'est juridiquement validé** : tout point ci-dessous est à
> confirmer avec ton conseil. Rien n'a été déclaré ni enregistré auprès d'une autorité.

Communs à tous les pays :
- **Identité de l'exploitant** : qui vend (LLC américaine ou structure française ?). La même entité doit figurer dans les mentions légales, les CGU/CGV, les factures et le compte Stripe.
- **Textes** : les passages `[À VALIDER]` / `[À COMPLÉTER]` attendent le juriste, dont l'offre de lancement (gratuité jusqu'au 31/12/2026 et conversion).
- **Non-discrimination des offres** : contrôle automatique et modération humaine en place. Leur suffisance est à valider.
- **Modération et signalements** (règlement européen DSA pour les pays de l'UE) :
  - signalement anonyme ;
  - décision motivée et envoyée à l'auteur du signalement ;
  - journal d'audit.

  Restent à confirmer : point de contact, recours, allègements pour une petite entreprise.
- **Sous-traitants** hors UE (Supabase, Stripe, Resend, Cloudflare, Google, Sentry) : encadrement des transferts (DPF, clauses types).
- **Publicité** : consentement via la CMP certifiée de Google (EEE, Royaume-Uni, Suisse). Aucune annonce sans ton accord.

| Pays | Données personnelles | Points propres au pays (à valider) |
|---|---|---|
| France | RGPD, CNIL (cookies) | Régime des opérateurs privés de placement (art. L.5321-1 et suivants) ; offres en français ; mentions légales LCEN avec l'hébergeur (coordonnées d'Iglao manquantes) ; TVA selon l'entité vendeuse |
| Belgique | RGPD, APD | Règles linguistiques régionales des offres ; régimes régionaux des agences d'emploi |
| Luxembourg | RGPD, CNPD | Règles des agences de placement à vérifier |
| Espagne | RGPD, AEPD | Offres en castillan (et langues co-officielles selon la région) ; règles des agences de placement |
| Suisse | nLPD (préposé fédéral) | Représentant en Suisse si l'exploitant n'y est pas établi ; consentement publicitaire |
| Royaume-Uni | UK GDPR, ICO, PECR (cookies) | Représentant au Royaume-Uni ; obligations éventuelles auprès de l'ICO |
| Canada | LPRPDE ; Loi 25 au Québec | Offres en français au Québec ; affichage d'une fourchette salariale dans certaines provinces ; taxes de vente |
| États-Unis | Lois des États (Californie notamment, selon les seuils) | Transparence salariale dans plusieurs États et villes ; non-discrimination (EEO) ; taxes de vente selon les États |
| Algérie | Loi 18-07, ANPDP | Déclaration ou autorisation préalable, transferts de données hors d'Algérie soumis à autorisation ; paiement des entreprises algériennes (Stripe n'y est pas disponible) |

Proposition déjà documentée : ouvrir pays par pays, en commençant par la France
([COMPLIANCE_LAUNCH.md](COMPLIANCE_LAUNCH.md) § 2), et adapter alors la mention « 9 pays » du
site (ACC-21).

## 11. Coûts récurrents à prévoir (rien n'est souscrit)

| Service | Nécessaire ? | Remarque |
|---|---|---|
| VPS Iglao | Oui | Selon l'offre retenue |
| Supabase Pro (production) | Oui | Sauvegardes et pas de mise en pause ; la PITR est une option en plus |
| Nom de domaine | Oui | Renouvellement annuel |
| Resend | Oui | Offre gratuite limitée en volume quotidien : à comparer au trafic attendu |
| Boîte de réception `support@` | Oui | Fournisseur au choix |
| Stockage de sauvegarde des fichiers | Recommandé | § 5 |
| Sentry, sonde de disponibilité | Recommandé | Offres gratuites suffisantes au lancement |
| Vercel (préproduction) | Déjà en Hobby | Les conditions de Vercel réservent Hobby à un usage non commercial ([DEPLOYMENT.md](DEPLOYMENT.md) § 3) |

## 12. Ordre des opérations et GO / NO GO

1. **Décisions (toi)** :
   - entité exploitante ;
   - pays ouverts ;
   - juriste ;
   - offre Iglao ;
   - Supabase Pro ;
   - boîte `support@`.
2. **Comptes et DNS (toi)** :
   - domaine (§ 2) ;
   - Resend ;
   - Turnstile production ;
   - Sentry ;
   - sonde de disponibilité.
3. **Base** (moi, avec un jeton temporaire) :
   - migrations ;
   - authentification et modèles d'e-mails ;
   - premier administrateur.
4. **Serveur** (ensemble) :
   - préparation ;
   - secrets ;
   - HTTPS ;
   - pare-feu.
5. **Premier déploiement** (ton approbation) : site en ligne mais **fermé au public**. Si besoin, `PREPROD_BASIC_AUTH` ou une règle Nginx le temps des vérifications.
6. **Vérifications** :
   - `/api/health` ;
   - parcours candidat et recruteur avec tes comptes ;
   - e-mail réel vers ton adresse ;
   - Turnstile ;
   - sauvegarde et test de restauration ;
   - sondes.
7. **GO / NO GO (toi)** : ouverture publique.
8. **Ensuite seulement, avec ton accord** :
   - Stripe live (avant la fin de la gratuité, le 31/12/2026) ;
   - AdSense (demande d'approbation, puis interrupteur).

Le détail de chaque point et son statut sont suivis dans [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).
