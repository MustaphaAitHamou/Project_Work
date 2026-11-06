# Sécurité

Ce document décrit les menaces prises en compte, les contrôles implémentés et testés, et les limites connues. Signaler une vulnérabilité : [À COMPLÉTER : adresse dédiée, par exemple security@<domaine>].

## Actifs sensibles

CV et profils des candidats, justificatifs de vérification des entreprises, données de facturation, comptes d'administration, clés d'API (Supabase, Stripe, e-mail, registres), jetons de l'API Tamurt HQ.

## Contrôles en place

### Authentification et comptes
- Supabase Auth : confirmation d'e-mail obligatoire, mot de passe de 10 caractères minimum avec minuscules, majuscules et chiffres, changement d'adresse doublement confirmé.
- Limitation des tentatives (connexion, inscription, réinitialisation, signalements, candidatures) côté base de données ; anti-robot Cloudflare Turnstile lorsqu'il est configuré.
- Comptes suspendus ou supprimés : accès coupé (contrôlé à chaque requête et dans les fonctions SQL).
- Aucun compte administrateur par défaut ; le premier super-administrateur est attribué explicitement à un compte confirmé (`scripts/grant-admin.mjs`), les suivants depuis le back-office avec journalisation. Le dernier super-administrateur ne peut pas être retiré.

### Autorisations
- **RLS sur toutes les tables**, droits par colonne pour les mises à jour directes, privilèges par défaut révoqués.
- Mutations sensibles uniquement via des fonctions SQL `SECURITY DEFINER` (avec `search_path` vide) qui revérifient l'acteur et la permission.
- Une entreprise ne voit que les candidatures reçues sur ses propres annonces ; aucune recherche dans une base de CV n'existe.
- Back-office : six rôles et une matrice de permissions appliquée en base (référence) et dans l'interface ; test de parité automatique. Les montants de revenus ne sont affichés qu'aux rôles finance et super-administrateur.
- Tests d'intégration dédiés : accès croisés entre candidats, entre entreprises, accès anonyme, élévation de rôle.

### Fichiers
- Compartiments privés, sans URL publique permanente ; téléchargement via contrôle des droits, journal d'accès et URL signée de 60 secondes avec téléchargement forcé (le fichier n'est jamais rendu sur le domaine de l'application).
- Vérification à l'envoi : taille maximale, type réel par signature binaire (l'extension et le type déclaré ne suffisent pas), PDF contenant JavaScript, actions de lancement, fichiers joints ou chiffrement refusés (y compris noms encodés), DOCX contenant des macros ou des objets OLE refusés, archives anormales (rapport de compression) refusées.
- Noms de fichiers assainis ; chemins de stockage générés côté serveur.

### Paiement
- Webhooks Stripe : signature vérifiée sur le corps brut, cohérence mode live/test avec l'environnement, idempotence (chaque événement traité une seule fois), protection contre les événements reçus dans le désordre.
- Publication uniquement après confirmation par Stripe ; jamais sur la base de l'URL de retour.
- En production, refus de créer un paiement avec une clé de test.
- Aucune donnée de carte ne transite par l'application (Stripe Checkout hébergé).

### Application web
- En-têtes : Content-Security-Policy (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action` limité au site et à Stripe), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`.
- Server Actions protégées par la vérification d'origine de Next.js ; redirections internes validées (pas de redirection ouverte).
- Rendu React (échappement par défaut) ; Markdown des textes juridiques rendu sans HTML brut ; personnalisations d'e-mails échappées.
- Secrets uniquement côté serveur (`server-only`) ; `.env*` ignorés par Git ; la CI ne manipule que les clés d'une pile locale éphémère.

### Traçabilité
- Journal d'audit des actions d'administration (ajout seul, non modifiable).
- Journal des accès aux données personnelles (téléchargements de CV et de justificatifs, exports) ; les accès à son CV sont visibles par le candidat dans l'export de ses données.

### API interne Tamurt HQ
- Jeton porteur affiché une seule fois, stocké sous forme d'empreinte SHA-256 ; liste d'adresses IP facultative vérifiée en base ; limitation de débit ; révocation immédiate ; réponses agrégées sans donnée personnelle.

## Limites connues et recommandations

| Sujet | État | Recommandation |
|---|---|---|
| Analyse antivirus des fichiers | **non implémentée** : contrôles structurels uniquement | ajouter une analyse (par exemple ClamAV dans une fonction dédiée ou un service commercial) avant la mise en stockage définitif |
| Double authentification des administrateurs | **non implémentée** dans l'interface | activer et exiger le TOTP de Supabase Auth pour les comptes du back-office |
| CSP | `'unsafe-inline'` autorisé pour les scripts et styles (scripts en ligne de Next.js) | passer à une CSP à nonce |
| Cookies de session | non `HttpOnly` (conception de `@supabase/ssr` pour le client navigateur) | le risque XSS est réduit par la CSP et l'échappement ; à réévaluer |
| Liste d'IP de l'API HQ | repose sur l'en-tête `x-forwarded-for` posé par l'hébergeur | derrière un autre proxy, s'assurer qu'il écrase cet en-tête |
| Limitation de débit | « fail open » si la base est indisponible | surveiller les erreurs ; ajouter une protection en amont (pare-feu applicatif) |
| Supervision | journaux Vercel/Supabase uniquement, pas d'alerting | brancher un outil d'alertes (erreurs serveur, échecs de webhook, file d'e-mails) |
| Durée des journaux d'audit et d'accès | pas de purge automatique | fixer une durée (voir DATA_RETENTION) |
| Tests d'intrusion | non réalisés | audit externe avant ouverture |

## Contrôles automatisés

- `npm audit --omit=dev --audit-level=high` en CI.
- Analyse statique des fonctions SQL (`supabase db lint`) en CI.
- Tests d'intégration RLS et tests E2E (accès refusé aux non-administrateurs, téléchargement de CV autorisé seulement au recruteur concerné, webhook non signé refusé, idempotence).
