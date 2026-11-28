# État du projet — 28 novembre 2026

Ce document distingue strictement ce qui est **implémenté et vérifié par des tests**, ce qui est **implémenté mais non validé contre le service réel** (faute d'accès ou de clés depuis l'environnement de développement), et ce qui **reste à faire ou à décider**.

## Résultats des tests

| Suite | Résultat (28/11, fin de journée) | Portée |
|---|---|---|
| Unitaires (`npm run test:unit`) | 156/156 (25 fichiers) | identifiants d'entreprise, vérification, fichiers, CV, masquage, inscription, recherche, données structurées, e-mails et **notifications de chaque modèle dans les 4 langues**, permissions, traductions, Turnstile, offre de lancement, fournisseur Resend (adresses de test jamais envoyées), **robots.txt** (robot AdSense autorisé en production) |
| Intégration (`npm run test:integration`) | 70/70 (10 fichiers) | RLS et droits, candidature en un clic, candidatures anonymes, cycle de vie annonce/abonnement/paiement, décisions d'administration, offre de lancement, **e-mails d'authentification** rendus par le vrai serveur d'authentification local et lus dans Mailpit (6 tests, 10 modèles, 4 langues) |
| Bout en bout (`npm run test:e2e`) | 54 réussis, 0 échec, 11 ignorés (65) | 53 dans la suite complète, plus le seul échec, corrigé puis rejoué (`session.spec.ts` 12/12) : son attente était fausse, l'application avait raison (un lien réutilisé par une personne déjà connectée la ramène à son espace). Ignorés ici, car exécutés à part : 6 Stripe réels, 4 Turnstile avec clés de test, 1 `ads.txt` (voir les lignes suivantes). Couvre parcours candidat, recruteur, inscription, back-office, tâches planifiées, webhook Stripe signé, publicités, accessibilité, offre de lancement, **recette automatisée** (`recette.spec.ts`, 10 tests : 9 marchés et filtres, erreurs de connexion, mot de passe oublié, modification d'annonce et retour en modération, clôture et réouverture gratuites, signalement traité, réglage invalide refusé, langues et 404, notifications, permissions) |
| Turnstile, clés de test Cloudflare (`TURNSTILE_E2E=1`) | 4/4 | jeton envoyé par chaque formulaire, nouveau jeton après une erreur, candidat et recruteur connectés, réinitialisation complète, signalement vérifié par Cloudflare |
| Préproduction réelle (`playwright.preprod.config.ts`), après le déploiement du 28/11 | `captcha-enforced` 4/4, `smoke` 4/4 (4 ignorés : vrai widget, T-10 manuel) | vraies clés, CAPTCHA Supabase actif : sans jeton valide, connexion, mot de passe oublié, inscription, renvoi et signalement refusés, sans compte créé ; langues et arabe RTL, 404 traduites, liens d'e-mail non consommés à l'ouverture, `noindex` et robots fermés |
| AdSense en mode `test` (identifiant factice) | 3/3 | `ads.txt`, politique de sécurité, emplacements `data-adtest`, balise de vérification |
| Stripe réel, mode test (`STRIPE_REAL=1`) | 6/6 parcours réels + 3/4 tests du webhook (25-28/11) | non relancé le 28 au soir (aucun changement de paiement) ; limite connue du 4e test : [STRIPE_TESTING.md](STRIPE_TESTING.md) |
| Qualité | OK | `tsc` strict, ESLint (0 erreur), `next build`, lint SQL, types générés à jour |

Les tests d'intégration et E2E s'exécutent contre une pile Supabase locale réelle (PostgreSQL, Auth, Storage, Mailpit) et le vrai serveur Next.js (en CI : build de production). La **CI GitHub Actions est verte** sur `main` : audit des dépendances, typage, lint, tests unitaires, migrations appliquées sur une base vierge, lint SQL, cohérence des types générés, tests d'intégration, build de production et tests E2E. Les tests E2E n'interrogent pas les registres d'entreprises (services tiers), pour rester déterministes.

## Implémenté et vérifié

**Candidats** — inscription avec confirmation d'e-mail, profil sans photo, expériences et formations, CV PDF/DOCX versionnés en stockage privé avec contrôle du contenu, accord de transmission versionné, candidature en un clic sans redirection, suivi des statuts (« consultée » uniquement après ouverture réelle), retrait, offres sauvegardées, alertes e-mail, export JSON (incluant le journal des téléchargements de CV), suppression de compte.

**Recruteurs** — création d'entreprise avec validation des identifiants par pays, vérification automatique ou manuelle, dépôt de justificatifs (supprimés à 90 jours), rédaction d'annonce avec contrôle anti-discrimination et revue humaine, paiement par abonnement mensuel par annonce, publication uniquement sur événement Stripe signé, délai de grâce et suspension, clôture et réouverture, consultation des candidatures et téléchargement de CV par lien signé de 60 secondes, décisions (présélection, embauche, refus) notifiées au candidat, notation et archivage internes. Aucune messagerie, aucune base de CV.

**Back-office** — six rôles, tableau de bord (indicateurs et graphiques accessibles, revenus réservés à la finance), vérification des entreprises, suspension (désormais notifiée par e-mail), modération des annonces, signalements, utilisateurs et rôles, pays et checklist de conformité (publication payante bloquée sans checklist ou dérogation motivée), tarifs versionnés par pays et devise, paiements et remboursements, demandes RGPD et effacement, règles de modération, modèles d'e-mails par langue, journal d'audit et d'accès, paramètres, clients de l'API Tamurt HQ.

**Transversal** — 4 langues (arabe en RTL), 9 marchés, 6 devises, recherche plein texte et par distance, sitemap et robots, en-têtes de sécurité, limitation de débit, file d'e-mails transactionnelle, tâches planifiées protégées, API Tamurt HQ (agrégats uniquement).

**Inscription et candidatures anonymes (16 novembre 2026)**
- Inscription : messages explicites par cas (champs manquants, e-mail invalide, mot de passe trop faible, adresse peut-être déjà inscrite avec liens vers la connexion et la réinitialisation, trop de tentatives, réseau, erreur technique), affichés sous les champs, annoncés aux lecteurs d'écran, saisie conservée, focus sur le premier champ à corriger ; limite par adresse en plus de la limite par IP ; un utilisateur connecté n'est plus jamais envoyé vers l'inscription (accueil et pages d'inscription). Affichage contrôlé sur ordinateur, tablette et mobile.
- Candidatures anonymes en deux phases (voir [SECURITY.md](SECURITY.md)) : alias par candidature, identité stockée à part, lectures recruteur uniquement par fonctions SQL, CV original verrouillé avant accord, CV anonymisé vérifié et validé par le candidat, demande de levée de l'anonymat en un clic (acceptation, refus sans rejet, expiration à 14 jours, retrait), journalisation et export. Nouvelle version de l'information préalable (`2026-11-16`) : chaque candidat la confirme une fois.
- Candidatures antérieures à la migration : l'identité est déplacée dans la table protégée (rien n'est supprimé) et reste visible du recruteur au titre du consentement donné à l'époque (demande d'origine « legacy_consent »), révocable par le candidat.
- Correctif d'affichage : sur mobile, la barre d'onglets des espaces candidat, recruteur et back-office élargissait la page ; elle défile désormais dans sa propre zone.

**Finalisation du lancement (28 novembre 2026, soir)**
- Authentification :
  - les liens des e-mails ne sont plus consommés par les filtres de messagerie : le jeton n'est utilisé qu'au clic sur la page de confirmation ;
  - 10 modèles d'e-mails d'authentification, en 4 langues, à l'identité Tamurt ;
  - Turnstile vérifié de bout en bout ;
  - CAPTCHA Supabase vérifié sur la préproduction réelle.
- Notifications dans les espaces candidat et recruteur (mêmes événements que les e-mails), avec « Tout marquer comme lu ».
- Défauts trouvés par la recette et corrigés :
  - une annonce en ligne proposait « Enregistrer le brouillon » (avec le message « Brouillon enregistré ») et « Soumettre pour publication », toujours refusé. Elle propose désormais « Enregistrer les modifications » et indique si la modification la renvoie en modération ;
  - la clôture d'une annonce gratuite annonçait « le renouvellement est arrêté » alors qu'il n'y en a pas. Elle indique maintenant qu'on peut la rouvrir gratuitement jusqu'au 31 décembre 2026 ;
  - une adresse inconnue sous une langue (`/es/…`) affichait une page 404 brute, sans traduction. Elle affiche maintenant la 404 traduite, avec l'en-tête du site.
- Finitions visuelles :
  - trait jaune ;
  - image Open Graph ;
  - police arabe chargée seulement en arabe ;
  - aucun débordement de 320 à 1440 px ;
  - logo et 9 pays sur mobile.
- Déploiement :
  - script de déploiement Vercel par l'API (commit testé, contrôles), branché dans le workflow GitHub ;
  - guide des secrets : [DEPLOYMENT_PREPROD.md](DEPLOYMENT_PREPROD.md) ;
  - Nginx de production : redirection `www` testée.
- Plan de production : [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md).

## Implémenté mais non validé contre le service réel

| Intégration | Ce qui est fait | Ce qui manque |
|---|---|---|
| **Stripe** | **Validé contre le vrai Stripe de test le 25/11** (voir [STRIPE_TESTING.md](STRIPE_TESTING.md)) : tarif, Checkout, abonnement, activation par webhook, renouvellement, échec, grâce, suspension, régularisation, résiliation, remboursement, 3D Secure, refus, portail client, événements dans le désordre | saisie de carte et écran du portail à vérifier à la main en préprod ; compte live, webhook live et Stripe Tax au lancement, après accord |
| **Resend** | fournisseur implémenté selon l'API documentée | clé API et domaine vérifié ; le chemin SMTP est, lui, testé de bout en bout avec Mailpit |
| **Registres d'entreprises** | France, VIES, Companies House, Zefix, OpenCorporates implémentés selon leurs contrats publiés, testés sur des réponses types | accès réseau et clés (Companies House, Zefix, OpenCorporates) ; en leur absence la vérification bascule en revue manuelle, comportement vérifié |
| **Cloudflare Turnstile** | vraies clés en préproduction ; widget validé à la main par le propriétaire (connexion, signalement) ; CAPTCHA Supabase actif et vérifié (refus sans jeton, 4/4) ; parcours complets vérifiés en local avec les clés de test (4/4) | étape 3 de T-10 à la main (connexions candidat et recruteur, mot de passe oublié et inscription vers une adresse du propriétaire) ; clés de production |
| **Supabase hébergé (préproduction)** | projet `tamurt-jobs-preprod` : 26 migrations, adresse du site et redirections, CAPTCHA actif | modèles d'e-mails Tamurt (prêts, à appliquer : jeton temporaire ou copier-coller, [EMAIL.md](EMAIL.md) § 3.2) ; SMTP non configuré (2 e-mails par heure, aux seuls membres de l'équipe) ; **publication fermée dans les 9 pays** ; projet de production non créé |
| **Vercel (préproduction)** | déployée et protégée (Vercel Authentication, `noindex`, robots `Disallow`), tâches planifiées quotidiennes (offre Hobby) ; déploiement du 28/11 fait par `scripts/vercel-deploy-preprod.sh`, le script du workflow : READY, commit et alias vérifiés par l'API ; protection, santé et `noindex` vérifiés sur l'alias (l'adresse unique du déploiement n'est pas joignable depuis ma session) | le workflow GitHub attend l'environnement `preprod` (jeton Vercel) : [DEPLOYMENT_PREPROD.md](DEPLOYMENT_PREPROD.md) ; il échoue explicitement d'ici là |
| **Iglao (production)** | serveur autonome, Nginx (redirection `www` ajoutée et testée le 28/11), systemd, cron, déploiement et retour arrière ([deploy/iglao](../deploy/iglao/README.md)), rejoués dans une simulation Ubuntu 24.04 avec E2E 43/43 ; plan complet : [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md) | VPS réel, domaine `tamurtjobs.com`, certificat |

## Reste à faire ou à décider

**Bloquant avant l'ouverture publique de la bêta gratuite** (actions du propriétaire, détail dans [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md))
- Domaine `tamurtjobs.com`, VPS Iglao, projet Supabase de production (Pro, UE), Resend (domaine vérifié et SMTP de Supabase), clés Turnstile de production.
- **Ouverture de la publication** dans les pays retenus (back-office → Pays, checklist ou dérogation motivée) : aujourd'hui fermée partout, même en préproduction, donc aucune annonce ne peut être publiée.
- Validation juridique des textes et identité de l'exploitant ; adaptation de la mention « 9 pays » si seuls certains pays ouvrent.
- Étape 3 de T-10 (connexion et e-mails réels avec le vrai widget) ; GO / NO GO.

**Bloquant avant ouverture payante**
- Validation juridique de tous les textes (`content/legal/`, mentions `[À COMPLÉTER]` / `[À VALIDER]`) et identification complète de Tamurt Services LLC.
- Checklist de conformité de chaque pays avec un conseil local ([COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md)) ; à la livraison, la publication payante est désactivée dans les neuf pays.
- Comptes et clés : Stripe live (et Stripe Tax), fournisseur d'e-mail, Turnstile, registres, projets Supabase et Vercel.
- Choix de la région d'hébergement et encadrement des transferts de données.

**Offre de lancement (28 novembre 2026)** — publication gratuite pour toutes les entreprises jusqu'au 31/12/2026 23:59:59 (Paris), puis 5,95 € HT par mois et par annonce ; mise en pause sans suppression des annonces non converties, conversion sans prélèvement avant la fin, rappels par e-mail. Détails et tests : [LAUNCH_OFFER.md](LAUNCH_OFFER.md). Clause des CGV recruteurs **à valider** par un conseil.

**Refonte visuelle premium (28 novembre 2026)** — Inter et Plus Jakarta Sans (plus de police à empattements), bleu roi, bleu nuit, touches de jaune et de turquoise, composants, pages et espaces revus, contrastes AA, CLS 0 à 0,02 : [DESIGN.md](DESIGN.md).

**Identité visuelle (DA Tamurt Services, novembre 2026, remplacée par la refonte du 28/11 pour la typographie et la palette)**
- Couleurs, police Bitter (abandonnée le 28/11), coins, logos, favicons et bouton yaz appliqués. Accueil refait avec un bandeau de marque illustré et des drapeaux en SVG. Chaque section a ses illustrations : engagements, état vide des offres, étapes, tableau de bord recruteur. Les textes sont agrandis pour la lecture. La frise « peigne » a été retirée : en pleine largeur, elle ressemblait à un défaut d'affichage. Vérifié : typecheck, lint, tests unitaires (64/64) et build. Rendu contrôlé en français et en arabe, en clair et en sombre.
- Tests d'intégration et E2E relancés le 16 novembre 2026 avec la pile Supabase locale : verts (voir ci-dessus).
- Bouton yaz masqué tant que `TAMURT_SERVICES_URL` est vide, puisque le site Tamurt Services n'est pas encore en ligne.

**Avant mise en production de l'anonymisation**
- Appliquer la migration `20261116090000_anonymous_applications.sql` sur le projet Supabase hébergé **avant** de déployer le code (les pages recruteur appellent les nouvelles fonctions).
- Activer l'anti-robot dans Supabase Auth (Turnstile), pour protéger aussi les appels directs au point d'inscription.
- Configurer un fournisseur SMTP dans Supabase Auth : sans lui, le service par défaut de Supabase refuse d'envoyer l'e-mail de confirmation aux adresses extérieures à l'équipe (`email_address_not_authorized`), ce qui fait échouer l'inscription.
- Faire valider juridiquement les textes mis à jour (confidentialité, conditions recruteurs).

**Recommandé**
- ~~Double authentification obligatoire pour les comptes du back-office~~ : faite le 25/11 (exigée par la base elle-même).
- Analyse antivirus des fichiers déposés (contrôles structurels seulement aujourd'hui).
- Durées de conservation des journaux d'audit, signalements, demandes et comptes inactifs ([DATA_RETENTION.md](DATA_RETENTION.md)).
- Relecture des traductions anglaise, espagnole et arabe par des locuteurs natifs, et traduction des textes juridiques en espagnol et en arabe (affichés aujourd'hui en anglais et en français avec un avertissement).
- Supervision : Sentry intégré (sans donnée personnelle), point de santé ; reste à brancher le DSN et une sonde de disponibilité.
- Audit d'accessibilité manuel et test d'intrusion externe.
- ~~Information de l'auteur d'un signalement sur la suite donnée~~ : faite le 25/11 (e-mail de décision dans sa langue).

**Exclu volontairement** (exigences du cahier des charges) : messagerie ou chat entre candidats et recruteurs, photo de profil, consultation d'une base de CV par les entreprises, transmission de données personnelles à Tamurt HQ.
