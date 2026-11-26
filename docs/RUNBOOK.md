# Exploitation — Tamurt Jobs

Procédures à suivre pour le lancement et en cas d'incident.

## 1. Avant chaque mise en production

1. Tests verts sur la branche : typage, lint, tests unitaires, d'intégration et E2E (voir `docs/LAUNCH_LOG.md`).
2. Sauvegarde manuelle de la base de production (section 2).
3. Migrations appliquées **avant** la promotion du code qui en dépend :

```bash
SUPABASE_ACCESS_TOKEN=<jeton du projet de production> node scripts/supabase-apply-migrations.mjs --project-ref <ref-production> --confirm-ref <ref-production>
```

Lancer d'abord avec `--dry-run` pour voir la liste. Le script n'applique que les migrations absentes de l'historique et s'arrête à la première erreur.

   Ne jamais utiliser `--include-seed` sur la préproduction ni la production : `supabase/seed.sql` est réservé au poste local et aux tests (il désactive la double authentification du back-office).
4. Déploiement de production : GitHub → Actions → **Production (Iglao)**, depuis `main`, puis ton approbation ([deploy/iglao/README.md](../deploy/iglao/README.md)). Ensuite, les vérifications de la section 4.

## 2. Sauvegardes et restauration

- **Automatique :** l'offre Supabase Pro fait une sauvegarde quotidienne, conservée 7 jours (Database → Backups). La restauration à un instant donné (PITR) est une option payante.
- **Manuelle (avant le lancement et avant chaque migration risquée) :** depuis un poste de confiance, avec la chaîne de connexion de la base de production (Supabase → Project Settings → Database). Ne la collez jamais dans un fichier versionné ni dans une conversation.

```bash
npx supabase db dump --db-url "$PROD_DB_URL" -f sauvegarde-schema.sql
```

```bash
npx supabase db dump --db-url "$PROD_DB_URL" --data-only -f sauvegarde-donnees.sql
```

Conservez ces fichiers chiffrés, hors du dépôt : ils contiennent des données personnelles.

Les fichiers (CV, justificatifs, logos) sont dans Supabase Storage ; ils ne sont pas inclus dans ces exports.

- **Restauration :**
  - restauration complète : Database → Backups → Restore. Elle remplace toute la base : à décider en connaissance de cause ;
  - restauration ciblée : réimporter les données depuis un export sur un projet de test, puis recopier ce qui manque.
- **Test de restauration :** restaurer au moins une fois l'export manuel sur le projet de préproduction, ou sur une base locale avec `psql`, et vérifier qu'on peut se connecter et consulter les offres.

## 3. Retour arrière (rollback)

| Problème | Action | Délai |
| --- | --- | --- |
| Le nouveau déploiement casse le site (production Iglao) | `ssh tamurt@<ip> /srv/tamurt-jobs/bin/rollback.sh` : version précédente en quelques secondes. Le déploiement revient déjà seul en arrière si la nouvelle version ne répond pas. | Immédiat |
| Le nouveau déploiement casse la préproduction (Vercel) | Vercel → Deployments → déploiement précédent → **Instant Rollback** | Immédiat |
| La publicité gêne ou pose problème | Back-office → Paramètres → `ads.enabled` = `false` | Immédiat |
| Paiements à suspendre | Back-office → Pays → désactiver la publication payante du pays (journalisé). Les abonnements en cours continuent. | Immédiat |
| Webhook Stripe en erreur | Stripe → Webhooks : les événements sont rejoués automatiquement pendant 3 jours. Corriger, puis « Renvoyer » les événements en échec si besoin. | Minutes |
| Migration fautive | Les migrations sont additives : corriger par une nouvelle migration. En dernier recours, restaurer la sauvegarde (section 2). | Variable |
| Fuite ou suspicion de compromission d'une clé | Révoquer la clé chez le fournisseur (Stripe, Resend, Supabase, Cloudflare), en créer une nouvelle, la saisir dans Vercel, redéployer. | Minutes |

## 4. Vérifications après déploiement

- `https://<domaine>/api/health` doit afficher `{"status":"ok","database":"ok"}`. En production, la réponse publique s'arrête là : elle ne dit pas quels services sont configurés.
- Back-office → tableau de bord, bloc « État des intégrations » : « Stripe : clé de production », secret du webhook, fournisseur d'e-mail, anti-robot ; aucune alerte de configuration. Le détail complet est aussi disponible avec le secret des tâches planifiées (`Authorization: Bearer <CRON_SECRET>`).
- La page d'accueil, la recherche et une fiche d'offre s'ouvrent.
- Inscription d'un compte réel : l'e-mail de confirmation arrive, et pas dans les indésirables.
- Back-office : connexion avec la double authentification ; tableau de bord sans alerte de configuration.
- `https://<domaine>/robots.txt` autorise l'indexation ; `https://<domaine>/sitemap.xml` liste les pages.

## 5. Surveillance

- **Disponibilité :** sonde HTTPS toutes les minutes sur `/api/health` (Better Stack ou UptimeRobot). Le point de santé répond 503 si la base est inaccessible et liste les problèmes de configuration.
- **Erreurs :** Sentry, quand le DSN est configuré.
- **Journaux du serveur (production) :**
  - application : `journalctl -u tamurt-jobs` ;
  - tâches planifiées : `journalctl -t tamurt-jobs-cron` ;
  - Nginx : `/var/log/nginx/`.
- **Journaux de la préproduction :** Vercel → Logs.
- **Paiements :** Stripe → Webhooks (taux d'échec) et back-office → Paiements (événements reçus).
- **E-mails :** back-office → tableau de bord (file d'e-mails) et Resend → Logs.

## 6. Incidents courants

- **Un administrateur a perdu son téléphone (double authentification).** Un super administrateur supprime le facteur dans Supabase → SQL Editor, après avoir vérifié l'identité de la personne par un autre canal :

```sql
delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'personne@exemple.com');
```

  À la connexion suivante, la personne enregistre une nouvelle application.

- **Une entreprise conteste une suspension ou un refus :** les motifs et les auteurs des décisions sont dans le journal d'audit (back-office → Journal).
- **Une demande RGPD (accès, effacement) :** back-office → Confidentialité. L'effacement supprime les CV, anonymise les candidatures et ferme les annonces.
