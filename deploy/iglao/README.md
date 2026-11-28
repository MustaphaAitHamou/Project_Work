# Production sur Iglao (VPS Linux)

La production de Tamurt Jobs tourne sur un **VPS Linux chez Iglao**. Vercel ne sert qu'à la préproduction. Ce dossier contient tout ce qu'il faut pour le serveur :

| Fichier | Rôle |
| --- | --- |
| `nginx/tamurt-jobs.conf` | HTTPS, redirection HTTP → HTTPS, proxy vers Node.js, fichiers statiques, taille des envois |
| `nginx/tamurt-jobs-bootstrap.conf` | premier démarrage, avant le certificat Let's Encrypt |
| `systemd/tamurt-jobs.service` | serveur Node.js, redémarré automatiquement, droits réduits |
| `cron/tamurt-jobs` | tâches planifiées (maintenance horaire, file d'e-mails, alertes) |
| `bin/deploy.sh` | installe une version, bascule dessus, vérifie qu'elle répond, sinon revient à la précédente |
| `bin/rollback.sh` | retour à la version précédente (ou à une version donnée) |
| `bin/run-cron.sh` | appelle une tâche planifiée sur le serveur local |
| `env.production.example` | modèle des réglages et secrets du serveur |

Le déploiement passe par GitHub Actions (`.github/workflows/deploy-iglao.yml`) : tests complets, construction, envoi, bascule. **Il ne se lance qu'à la main, après ton approbation.**

## 1. L'offre Iglao à choisir

- **VPS Linux (KVM)** : 2 vCPU, **4 Go de RAM** et 40 Go de disque au minimum, avec **Ubuntu 24.04 LTS** (ou Debian 12).
- Les hébergements mutualisés cPanel et Plesk ne conviennent pas. Iglao n'y annonce pas Node.js, et Tamurt Jobs a besoin :
  - d'un processus Node.js permanent (version 22.12 ou plus) ;
  - de tâches planifiées toutes les 10 minutes ;
  - de webhooks Stripe.
- Adresse IPv4 dédiée : le domaine (enregistrement A) pointe dessus.

**À confirmer auprès d'Iglao** (non trouvé dans leurs offres publiques) :
- la sauvegarde ou les instantanés du VPS ;
- l'IPv6 ;
- le comportement de la protection anti-DDoS envers les webhooks de Stripe.

## 2. Ce qui tourne où

```
Visiteur ──HTTPS──> Nginx (443, Let's Encrypt) ──> Node.js 22 (127.0.0.1:3000, systemd)
                                                        │
cron ──> bin/run-cron.sh ──> /api/cron/* ───────────────┤
                                                        ├──> Supabase (base, comptes, fichiers)
                                                        ├──> Stripe (paiements) <── webhooks
                                                        └──> Resend (e-mails)
```

- Le serveur ne garde **aucune donnée métier**. La base, les comptes et les fichiers (CV, justificatifs, logos) sont chez Supabase. Le serveur peut donc être reconstruit à tout moment.
- Le code est construit par GitHub Actions avec `NEXT_OUTPUT=standalone`. Le résultat est un serveur autonome (`server.js` et les seuls modules nécessaires), sans `npm install` sur le VPS.
- La construction n'a besoin d'**aucun secret** : seulement les réglages publics `NEXT_PUBLIC_*` et `APP_ENV`. Les secrets restent dans `/etc/tamurt-jobs/env`, sur le serveur.

Arborescence sur le serveur :

```
/srv/tamurt-jobs/
  releases/<date>-<commit>/   une version complète (5 versions conservées)
  current -> releases/…       version en ligne (lien symbolique)
  shared/_next/static/        fichiers de construction de toutes les versions (servis par Nginx)
  incoming/                   archives reçues de GitHub Actions
  bin/                        deploy.sh, rollback.sh, run-cron.sh
/etc/tamurt-jobs/env          réglages et secrets (root:tamurt, 640)
```

## 3. Préparer le VPS (une seule fois, en root)

```bash
timedatectl set-timezone UTC
```

```bash
apt-get update && apt-get -y upgrade && apt-get install -y nginx certbot curl ufw unattended-upgrades
```

Node.js 22 (dépôt officiel NodeSource : Ubuntu 24.04 ne fournit que Node.js 18) :

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh && bash /tmp/nodesource_setup.sh && apt-get install -y nodejs && node --version
```

Utilisateur de l'application et dossiers :

```bash
useradd --system --create-home --home-dir /srv/tamurt-jobs --shell /bin/bash tamurt
```

Le dossier doit rester lisible par Nginx (utilisateur `www-data`), qui sert les fichiers de `shared/`. `useradd` le crée en 750 : sans cette commande, toutes les pages s'affichent sans leurs scripts (constaté lors de la simulation).

```bash
chmod 755 /srv/tamurt-jobs
```

```bash
install -d -o tamurt -g tamurt /srv/tamurt-jobs/releases /srv/tamurt-jobs/shared /srv/tamurt-jobs/incoming /srv/tamurt-jobs/bin && install -d -m 700 -o tamurt -g tamurt /srv/tamurt-jobs/.ssh && install -d -m 750 -o root -g tamurt /etc/tamurt-jobs && install -d /var/www/letsencrypt
```

Copier les fichiers de ce dossier sur le serveur (par exemple avec `scp -r deploy/iglao root@<ip>:/root/`), puis :

```bash
install -m 755 -o tamurt -g tamurt /root/iglao/bin/*.sh /srv/tamurt-jobs/bin/
```

```bash
install -m 644 /root/iglao/systemd/tamurt-jobs.service /etc/systemd/system/ && install -m 644 /root/iglao/cron/tamurt-jobs /etc/cron.d/tamurt-jobs
```

Autoriser l'utilisateur `tamurt` à redémarrer le service, et rien d'autre :

```bash
echo 'tamurt ALL=(root) NOPASSWD: /usr/bin/systemctl restart tamurt-jobs' > /etc/sudoers.d/tamurt-jobs && chmod 440 /etc/sudoers.d/tamurt-jobs && visudo -c
```

Pare-feu (SSH, HTTP, HTTPS ; Node.js n'écoute que sur 127.0.0.1) :

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

SSH par clé uniquement. Avant d'appliquer, vérifier que ta propre clé fonctionne :

```bash
sed -i -e 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/' -e 's/^#\?PermitRootLogin .*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config && systemctl reload ssh
```

## 4. Réglages et secrets du serveur

```bash
install -m 640 -o root -g tamurt /root/iglao/env.production.example /etc/tamurt-jobs/env
```

```bash
nano /etc/tamurt-jobs/env
```

- Remplir chaque valeur **directement sur le serveur**, jamais dans le dépôt ni dans une conversation.
- `CRON_SECRET` se génère sur le serveur :

```bash
openssl rand -hex 32
```

- `APP_ENV=production`, `CLIENT_IP_HEADER=x-real-ip` (adresse du visiteur transmise par Nginx), clés Stripe **live seulement après ton accord**.

## 5. HTTPS (Let's Encrypt)

1. Le domaine **et** `www.<domaine>` pointent vers l'IP du VPS (enregistrements A, et AAAA si le VPS a une IPv6). `www` redirige ensuite vers le domaine principal, en une seule redirection (vérifié le 28/11 avec Nginx 1.24 et un certificat de test).
2. Configuration de démarrage, puis certificat (remplacer `jobs.example.com`) :

```bash
sed 's/jobs.example.com/<domaine>/g' /root/iglao/nginx/tamurt-jobs-bootstrap.conf > /etc/nginx/sites-available/tamurt-jobs && ln -sf /etc/nginx/sites-available/tamurt-jobs /etc/nginx/sites-enabled/tamurt-jobs && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx
```

```bash
certbot certonly --webroot -w /var/www/letsencrypt -d <domaine> -d www.<domaine> --deploy-hook "systemctl reload nginx"
```

3. Configuration définitive :

```bash
sed 's/jobs.example.com/<domaine>/g' /root/iglao/nginx/tamurt-jobs.conf > /etc/nginx/sites-available/tamurt-jobs && nginx -t && systemctl reload nginx
```

- Si `nginx -t` refuse les lignes `listen [::]:…` (VPS sans IPv6), les supprimer.
- Le renouvellement est automatique (minuteur installé avec certbot). Pour le tester :

```bash
certbot renew --dry-run
```

## 6. Clé de déploiement et GitHub Actions

Sur ton ordinateur (pas sur le serveur), une clé réservée au déploiement :

```bash
ssh-keygen -t ed25519 -N "" -C "tamurt-jobs-deploy" -f tamurt-deploy
```

- `tamurt-deploy.pub` → sur le serveur, dans `/srv/tamurt-jobs/.ssh/authorized_keys` (propriétaire `tamurt`, droits 600).
- `tamurt-deploy` (clé privée) → GitHub, secret `IGLAO_SSH_KEY` (voir ci-dessous), puis supprimer le fichier de ton ordinateur.
- Empreinte du serveur, à vérifier dans la console Iglao avant de la copier dans le secret `IGLAO_KNOWN_HOSTS` :

```bash
ssh-keyscan -t ed25519 <ip-du-vps>
```

Dans GitHub → Settings → Environments → **New environment** `production` :

| Type | Nom | Valeur |
| --- | --- | --- |
| Protection | Required reviewers | toi : chaque déploiement attend ton approbation |
| Variable | `IGLAO_HOST` | IP ou nom du VPS |
| Variable | `IGLAO_USER` | `tamurt` |
| Variable | `NEXT_PUBLIC_SITE_URL` | `https://<domaine>` |
| Variable | `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase de production |
| Variable | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publique du projet de production |
| Variable | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | clé de site Turnstile (publique) |
| Variable | `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-…` (facultatif) |
| Variable | `NEXT_PUBLIC_SENTRY_DSN` | DSN Sentry (facultatif) |
| Secret | `IGLAO_SSH_KEY` | clé privée de déploiement |
| Secret | `IGLAO_KNOWN_HOSTS` | ligne de `ssh-keyscan` vérifiée |

Les valeurs `NEXT_PUBLIC_*` sont publiques par nature (elles sont visibles dans le navigateur). Les mêmes valeurs doivent figurer dans `/etc/tamurt-jobs/env`.

## 7. Déployer

1. Appliquer d'abord les migrations de base de données, depuis un poste de confiance. Voir `docs/DEPLOYMENT.md` ; jamais `--include-seed`.
2. GitHub → Actions → **Production (Iglao)** → Run workflow sur `main`, en saisissant `production`.
3. Approuver le déploiement quand GitHub le demande.

Le workflow :
1. lance la CI complète : typage, lint, tests unitaires, d'intégration et E2E ;
2. construit le serveur autonome ;
3. l'envoie sur le VPS ;
4. exécute `deploy.sh`.

`deploy.sh` :
- refuse une archive qui contiendrait un fichier `.env` ;
- bascule sur la nouvelle version, redémarre et attend que `/api/health` réponde avec la base accessible ;
- **revient automatiquement à la version précédente** si ce n'est pas le cas.

Enfin, le workflow vérifie `https://<domaine>/api/health` depuis l'extérieur.

## 8. Revenir en arrière

```bash
ssh tamurt@<ip> /srv/tamurt-jobs/bin/rollback.sh
```

- Ramène la version précédente en quelques secondes.
- Pour une version précise : `rollback.sh <identifiant>`. La liste s'obtient avec `ls /srv/tamurt-jobs/releases`.
- La base n'est pas modifiée. Les migrations sont additives, donc la version précédente du code continue de fonctionner.

## 9. Journaux et surveillance

Application :

```bash
journalctl -u tamurt-jobs -f
```

Tâches planifiées (code HTTP et résumé de chaque exécution) :

```bash
journalctl -t tamurt-jobs-cron --since today
```

- **Nginx :** `/var/log/nginx/`. Ces journaux contiennent des adresses IP : régler leur conservation à 14 jours (`/etc/logrotate.d/nginx` : `daily` et `rotate 14`).
- **Erreurs :** Sentry, si `NEXT_PUBLIC_SENTRY_DSN` est défini.
- **Disponibilité :** sonde externe sur `https://<domaine>/api/health`. En production, la réponse publique se limite à `{"status","database"}`.

## 10. Sauvegardes

- **Base de données :** Supabase Pro (sauvegarde quotidienne, 7 jours), plus un export manuel avant le lancement et avant chaque migration risquée (`docs/RUNBOOK.md`).
- **Fichiers** (CV, justificatifs, logos) : Supabase Storage, absents des sauvegardes de la base. **Point ouvert.**
- **Serveur :**
  - garder une copie de `/etc/tamurt-jobs/env` dans un gestionnaire de mots de passe ;
  - instantané du VPS si Iglao le propose ;
  - tout le reste se reconstruit avec ce dossier et un déploiement.

## 11. Mettre à jour le serveur

- Les mises à jour de sécurité du système s'installent seules (`unattended-upgrades`).
- Pour Node.js, une mise à jour de la version 22 se fait avec `apt-get upgrade`, puis :

```bash
systemctl restart tamurt-jobs
```

## 12. Ce qui a été vérifié sans le VPS

Dans un conteneur Ubuntu 24.04 (Nginx 1.24, Node.js 22), le 25/11/2026 :
- construction du serveur autonome **sans aucun secret** : 30 Mo ;
- contenu de l'archive : textes juridiques présents, module d'images natif Linux x64, aucun fichier `.env` ;
- les deux configurations Nginx sont acceptées par `nginx -t` (sans les lignes IPv6, absentes du conteneur) ;
- installation par `deploy.sh` dans une arborescence `/srv/tamurt-jobs` simulée, avec Nginx devant ;
- suite E2E complète passée à travers Nginx (résultats dans `docs/LAUNCH_LOG.md`) ;
- tâches planifiées appelées par `run-cron.sh` ;
- retour arrière, et retour automatique quand la nouvelle version ne répond pas.

**Non vérifiable ici** (à faire sur le VPS) :
- systemd ;
- certbot avec le vrai domaine ;
- pare-feu ;
- performances réelles du VPS.
