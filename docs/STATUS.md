# État du projet — 28 novembre 2026

Ce document distingue strictement ce qui est **implémenté et vérifié par des tests**, ce qui est **implémenté mais non validé contre le service réel** (faute d'accès ou de clés depuis l'environnement de développement), et ce qui **reste à faire ou à décider**.

## Résultats des tests

| Suite | Résultat (28/11) | Portée |
|---|---|---|
| Unitaires (`npm run test:unit`) | 149/149 | identifiants d'entreprise, vérification, fichiers, CV, masquage, inscription, recherche, données structurées, e-mails (dont offre de lancement), permissions, traductions, Turnstile, offre de lancement (dates de Paris, essai Stripe, consentement au premier prélèvement) |
| Intégration SQL (`npm run test:integration`) | 64/64 | RLS et droits, candidature en un clic, candidatures anonymes, cycle de vie annonce/abonnement/paiement (modèle payant 2027), décisions d'administration, **offre de lancement** (15 tests : instants limites de Paris, transition, webhooks en double et désordonnés, priorité des e-mails, réglage du back-office) |
| Bout en bout (`npm run test:e2e`) | 44 réussis, 0 échec, 7 ignorés (serveur de production local, version refondue) | parcours candidat, recruteur, inscription, back-office, tâches planifiées, webhook Stripe signé, publicités, accessibilité axe (FR/AR, sombre), **offre de lancement** (bandeau, publication gratuite, conversion, fin simulée). Ignorés : 6 parcours Stripe réels (suite à part) et le test `ads.txt` (sans identifiant AdSense) |
| Stripe réel, mode test (`STRIPE_REAL=1`) | 6/6 parcours réels + 3/4 tests du webhook | dont la **conversion d'une annonce gratuite** avec horloge de test Stripe. Le 4e test du webhook (« garde de renouvellement ») exige un serveur **sans** clé Stripe : il passe dans la suite standard, échoue avec clé (limite connue, [STRIPE_TESTING.md](STRIPE_TESTING.md)) |
| Qualité | OK | `tsc` strict, ESLint, `next build` sans avertissement, décalage de mise en page 0 à 0,02 |

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

## Implémenté mais non validé contre le service réel

| Intégration | Ce qui est fait | Ce qui manque |
|---|---|---|
| **Stripe** | **Validé contre le vrai Stripe de test le 25/11** (voir [STRIPE_TESTING.md](STRIPE_TESTING.md)) : tarif, Checkout, abonnement, activation par webhook, renouvellement, échec, grâce, suspension, régularisation, résiliation, remboursement, 3D Secure, refus, portail client, événements dans le désordre | saisie de carte et écran du portail à vérifier à la main en préprod ; compte live, webhook live et Stripe Tax au lancement, après accord |
| **Resend** | fournisseur implémenté selon l'API documentée | clé API et domaine vérifié ; le chemin SMTP est, lui, testé de bout en bout avec Mailpit |
| **Registres d'entreprises** | France, VIES, Companies House, Zefix, OpenCorporates implémentés selon leurs contrats publiés, testés sur des réponses types | accès réseau et clés (Companies House, Zefix, OpenCorporates) ; en leur absence la vérification bascule en revue manuelle, comportement vérifié |
| **Cloudflare Turnstile** | widget, vérification serveur, jetons transmis à Supabase Auth (inscription, connexion, mot de passe, renvoi de confirmation : tests unitaires) ; vraies clés du widget dans Vercel (préproduction) | le vrai widget pose un défi interactif aux navigateurs automatisés : recette manuelle T-10 à faire, puis activation de la protection dans Supabase ([RECETTE.md](RECETTE.md)) |
| **Supabase hébergé (préproduction)** | projet `tamurt-jobs-preprod` : 26 migrations appliquées (dont l'offre de lancement, le 28/11), adresse du site et redirections réglées | modèles d'e-mails d'authentification et captcha (choix du propriétaire) ; projet de production non créé |
| **Vercel (préproduction)** | déployée et protégée (Vercel Authentication, `noindex`, robots `Disallow`), tâches planifiées quotidiennes (offre Hobby) | le workflow GitHub n'a encore jamais déployé : l'environnement GitHub « preprod » n'est pas configuré (il échoue désormais explicitement) ; déploiements faits par l'API Vercel |
| **Iglao (production)** | serveur autonome, Nginx, systemd, cron, déploiement et retour arrière ([deploy/iglao](../deploy/iglao/README.md)), rejoués dans une simulation Ubuntu 24.04 avec E2E 43/43 | VPS réel, domaine, certificat |

## Reste à faire ou à décider

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
