# État du projet — 16 novembre 2026

Ce document distingue strictement ce qui est **implémenté et vérifié par des tests**, ce qui est **implémenté mais non validé contre le service réel** (faute d'accès ou de clés depuis l'environnement de développement), et ce qui **reste à faire ou à décider**.

## Résultats des tests

| Suite | Résultat | Portée |
|---|---|---|
| Unitaires (`npm run test:unit`) | 112/112 | validation des identifiants d'entreprise (formats, clés de contrôle), moteur de vérification, analyse des fichiers (PDF/DOCX malveillants), extraction du texte des CV, masquage des données personnelles (FR, EN, ES), validation et erreurs d'inscription, paramètres de recherche, données structurées d'offre, rendu des e-mails, parité des permissions SQL/TypeScript, traductions (clés et structure ICU identiques dans les 4 langues) |
| Intégration SQL (`npm run test:integration`) | 45/45 | RLS et droits (accès croisés, base de CV inaccessible, élévation de privilèges, fonctions réservées), candidature en un clic (atomicité, doublons concurrents, quotas, accord préalable, statut « consultée »), **candidatures anonymes** (profil chargé de données personnelles, vue recruteur avant accord, contournements par table, historique, fichier et identifiant, demande, acceptation, refus, expiration, retrait, changements de statut, rétention, export), cycle de vie annonce/abonnement/paiement, décisions d'administration et notifications |
| Bout en bout (`npm run test:e2e`) | 37/37 | parcours candidat complet (dont vérification du CV anonymisé, réponse à une demande d'identité, retrait de l'accès), parcours recruteur complet (profil anonyme, CV original verrouillé, demande puis levée de l'anonymat), inscription (champs manquants, e-mail invalide, mot de passe faible, adresse déjà inscrite, trop de tentatives, hors ligne, erreur serveur, confirmation par e-mail, utilisateur déjà connecté), webhook Stripe, back-office (8 scénarios), tâches planifiées, accessibilité (axe, WCAG 2.2 A/AA, FR/AR, thème sombre, nouveaux écrans compris) |
| Qualité | OK | `tsc` strict, ESLint sans erreur, `supabase db lint` sans erreur, `npm audit` (production) sans vulnérabilité, `next build` réussi |

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
| **Stripe** | Checkout, abonnements, portail client, remboursements, synchronisation des prix, webhooks (18 types d'événements) ; testés avec des **événements signés synthétiques** envoyés au vrai point d'entrée | compte Stripe live, clés, endpoint de webhook enregistré, Stripe Tax ; aucun appel réel à l'API Stripe n'a pu être fait. Le test « facture de renouvellement d'une annonce clôturée » vérifie que l'arrêt est **enregistré en erreur et rejoué** faute d'accès à l'API |
| **Resend** | fournisseur implémenté selon l'API documentée | clé API et domaine vérifié ; le chemin SMTP est, lui, testé de bout en bout avec Mailpit |
| **Registres d'entreprises** | France, VIES, Companies House, Zefix, OpenCorporates implémentés selon leurs contrats publiés, testés sur des réponses types | accès réseau et clés (Companies House, Zefix, OpenCorporates) ; en leur absence la vérification bascule en revue manuelle, comportement vérifié |
| **Cloudflare Turnstile** | widget, vérification serveur, transmission à Supabase Auth | clés et activation dans Supabase ; non testé |
| **Supabase hébergé / Vercel** | migrations, configuration, crons, guide de déploiement | projet et déploiement réels non créés |

## Reste à faire ou à décider

**Bloquant avant ouverture payante**
- Validation juridique de tous les textes (`content/legal/`, mentions `[À COMPLÉTER]` / `[À VALIDER]`) et identification complète de Tamurt Services LLC.
- Checklist de conformité de chaque pays avec un conseil local ([COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md)) ; à la livraison, la publication payante est désactivée dans les neuf pays.
- Comptes et clés : Stripe live (et Stripe Tax), fournisseur d'e-mail, Turnstile, registres, projets Supabase et Vercel.
- Choix de la région d'hébergement et encadrement des transferts de données.

**Identité visuelle (DA Tamurt Services, novembre 2026)**
- Couleurs, police Bitter, coins, logos, favicons et bouton yaz appliqués. Accueil refait avec un bandeau de marque illustré et des drapeaux en SVG. Chaque section a ses illustrations : engagements, état vide des offres, étapes, tableau de bord recruteur. Les textes sont agrandis pour la lecture. La frise « peigne » a été retirée : en pleine largeur, elle ressemblait à un défaut d'affichage. Vérifié : typecheck, lint, tests unitaires (64/64) et build. Rendu contrôlé en français et en arabe, en clair et en sombre.
- Tests d'intégration et E2E relancés le 16 novembre 2026 avec la pile Supabase locale : verts (voir ci-dessus).
- Bouton yaz masqué tant que `TAMURT_SERVICES_URL` est vide, puisque le site Tamurt Services n'est pas encore en ligne.

**Avant mise en production de l'anonymisation**
- Appliquer la migration `20261116090000_anonymous_applications.sql` sur le projet Supabase hébergé **avant** de déployer le code (les pages recruteur appellent les nouvelles fonctions).
- Activer l'anti-robot dans Supabase Auth (Turnstile), pour protéger aussi les appels directs au point d'inscription.
- Configurer un fournisseur SMTP dans Supabase Auth : sans lui, le service par défaut de Supabase refuse d'envoyer l'e-mail de confirmation aux adresses extérieures à l'équipe (`email_address_not_authorized`), ce qui fait échouer l'inscription.
- Faire valider juridiquement les textes mis à jour (confidentialité, conditions recruteurs).

**Recommandé**
- Double authentification obligatoire pour les comptes du back-office (non implémentée).
- Analyse antivirus des fichiers déposés (contrôles structurels seulement aujourd'hui).
- Durées de conservation des journaux d'audit, signalements, demandes et comptes inactifs ([DATA_RETENTION.md](DATA_RETENTION.md)).
- Relecture des traductions anglaise, espagnole et arabe par des locuteurs natifs, et traduction des textes juridiques en espagnol et en arabe (affichés aujourd'hui en anglais et en français avec un avertissement).
- Supervision et alertes (erreurs serveur, webhooks en échec, file d'e-mails).
- Audit d'accessibilité manuel et test d'intrusion externe.
- Information de l'auteur d'un signalement sur la suite donnée (obligations du règlement sur les services numériques à analyser).

**Exclu volontairement** (exigences du cahier des charges) : messagerie ou chat entre candidats et recruteurs, photo de profil, consultation d'une base de CV par les entreprises, transmission de données personnelles à Tamurt HQ.
