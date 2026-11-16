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

### Candidatures anonymes (« le talent avant les préjugés »)
- **Deux phases.** Présélection : le recruteur voit un profil professionnel sous un alias propre à chaque candidature (« Candidat #TJ-7K4Q9M », tiré au hasard, sans lien entre deux candidatures d'une même personne). Puis, sur demande du recruteur et **avec l'accord du candidat** : nom, e-mail, téléphone, ville et CV original. Un refus ne rejette jamais la candidature ; le candidat peut retirer l'accès plus tard (sans pouvoir effacer ce que le recruteur a déjà noté ou téléchargé).
- **Séparation des données.** L'identité est stockée à part (`application_identities`, aucun droit direct pour `anon`/`authenticated`). Le profil transmis ne contient ni nom, ni coordonnées, ni ville, ni dates de diplôme ; ses textes libres sont masqués (e-mails, liens, numéros, nom de la personne) par `app.mask_personal_text`.
- **Aucun accès direct.** Les recruteurs ne lisent plus les tables `applications` ni `application_status_history` (dont la colonne `changed_by` aurait relié les candidatures d'une même personne) : toutes leurs lectures passent par des fonctions `SECURITY DEFINER` (`recruiter_list_applications`, `recruiter_get_application`, `recruiter_application_counts`) qui appliquent la règle en base. Le CV original n'est délivré qu'après acceptation (`authorize_application_resume_download`, et `authorize_resume_download` pour les liens par version) ; l'identifiant du candidat et celui de la version du CV ne sont jamais exposés au recruteur.
- **Fin d'accès.** L'identité redevient invisible si la candidature est refusée, retirée ou anonymisée, ou si le candidat retire son accord.
- **CV anonymisé.** À l'envoi, le serveur extrait le texte du corps du document (PDF via unpdf, DOCX lu directement) sans photo, en-têtes, pieds de page, métadonnées ni nom de fichier, puis masque les données personnelles détectées (`src/lib/privacy/redact.ts`). Le candidat relit, corrige et valide ; la base remasque le texte enregistré et refuse la validation tant qu'une donnée personnelle est encore détectée. Le recruteur ne lit que la version validée.
- **Traçabilité.** Demandes, acceptations, refus, retraits et consultations de l'identité sont journalisés dans `data_access_logs` et figurent dans l'export de données du candidat. Les e-mails et notifications envoyés aux recruteurs ne contiennent que l'alias et l'intitulé de l'annonce.
- **Limite assumée.** Le masquage est fondé sur des règles : il ne peut pas garantir l'anonymat (un intitulé rare ou une petite entreprise peuvent suffire à identifier quelqu'un). C'est pourquoi le candidat valide lui-même la version transmise, et les écrans le disent explicitement.
- **Pas de décision automatisée.** Le tri proposé au recruteur ne repose que sur les compétences requises déclarées, la note interne et les dates ; aucune donnée sensible n'est utilisée.

### Inscription
- Messages d'erreur explicites (champs manquants, e-mail invalide, mot de passe trop faible, adresse peut-être déjà inscrite, trop de tentatives, erreur réseau ou technique) sous les champs concernés et annoncés aux lecteurs d'écran ; jamais de détail technique en production (le code d'erreur de Supabase Auth n'est affiché qu'hors production pour faciliter le diagnostic).
- Limitation : 10 inscriptions par heure et par IP, 5 par heure et par adresse.
- Énumération des comptes : le formulaire indique qu'une adresse « est peut-être déjà associée à un compte ». C'est un choix produit : le point d'entrée d'inscription de Supabase Auth, public, donne déjà cette information à qui l'appelle directement. Le risque est borné par les limites ci-dessus et par l'anti-robot (à activer **dans Supabase Auth** pour protéger aussi l'appel direct).

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
| Anonymisation des CV | masquage par règles, sans reconnaissance d'entités ni lecture des CV scannés (OCR) | le candidat valide la version transmise ; envisager une détection d'entités nommées et un OCR si le volume le justifie |

## Contrôles automatisés

- `npm audit --omit=dev --audit-level=high` en CI.
- Analyse statique des fonctions SQL (`supabase db lint`) en CI.
- Tests d'intégration RLS et tests E2E (accès refusé aux non-administrateurs, téléchargement de CV autorisé seulement au recruteur concerné et après accord du candidat, contournements de l'anonymat par table, historique, fichier ou URL directe, webhook non signé refusé, idempotence).
