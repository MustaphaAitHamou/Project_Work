# Recette manuelle — Tamurt Jobs (préproduction)

But : utiliser le site comme un candidat, un recruteur payant et un administrateur, sur chaque appareil et dans chaque langue, avant le GO / NO GO du lancement.

## Avant de commencer

- **URL de préproduction :** `https://tamurt-jobs-preprod.vercel.app`.
  - Le site est protégé par **Vercel Authentication** : il faut être connecté à ton compte Vercel, membre de l'équipe du projet. Cette protection reste toujours active.
- **Comptes de test :** ils sont créés par `scripts/preprod-seed.mjs` (candidat, recruteur vérifié, administrateur) et leur liste est fournie à la livraison.
  - Ils n'existent qu'en préproduction.
  - Les données de démonstration sont marquées comme fictives.
- **Paiements :** mode test Stripe uniquement. Les cartes de test sont dans [STRIPE_TESTING.md](STRIPE_TESTING.md) (section 3). Aucune vraie carte.
- **E-mails :** ils arrivent dans la boîte de l'adresse utilisée. Pour les comptes de démonstration, se connecter avec les identifiants fournis.

## Déjà couvert par les tests automatiques (28/11/2026)

Ces étapes sont rejouées à chaque push par la CI (pile Supabase locale, serveur de production
local). La recette manuelle reste utile pour le rendu réel, les appareils et les e-mails reçus,
mais un échec y serait une régression :

| Étapes | Tests |
| --- | --- |
| C-01 à C-03 (inscription, erreurs de connexion, mot de passe oublié, liens d'e-mail invalides) | `session.spec.ts`, `recette.spec.ts` |
| C-04, C-05, C-08, C-09 (profil, CV, candidature, suivi) | `candidate-flow.spec.ts` |
| C-06 (recherche dans les 9 marchés, filtres) | `recette.spec.ts` |
| C-12 (notifications dans l'espace candidat) | `recette.spec.ts` |
| C-14, A-13 (effacement d'un compte) | `admin.spec.ts` |
| R-01, R-02, R-05, R-10, R-13 | `employer-flow.spec.ts`, `recette.spec.ts` |
| R-06 à R-08, R-11, R-12, R-14 à R-16 (Stripe de test réel) | `stripe-real.spec.ts` (suite à part, `STRIPE_REAL=1`) |
| R-09 (modification d'une annonce en ligne, retour en modération) | `recette.spec.ts` |
| L-01 à L-04 (offre de lancement, fin simulée, notification de mise en pause) | `launch-offer.spec.ts` |
| A-01, A-02, A-04 à A-06, A-10 à A-12, A-16 | `admin.spec.ts`, `admin-mfa.spec.ts` |
| A-07 (signalement traité et journalisé), A-15 (réglage invalide refusé) | `recette.spec.ts` |
| T-02, T-04, T-05, T-06 (langues, accessibilité, droits, 404 traduites) | `accessibility.spec.ts`, `recette.spec.ts` |
| T-08 (emplacements publicitaires, modes `placeholder` et `test`) | `ads.spec.ts` |
| T-10 (le CAPTCHA est exigé par Supabase et par l'application) | `tests/preprod/captcha-enforced.spec.ts` (préproduction réelle) |

## Signaler un bug

Message dans cette conversation, ou ticket GitHub (modèle « Bug de recette »), avec :
1. l'identifiant de l'étape (par exemple `R-06`) ;
2. l'appareil, le navigateur et la langue ;
3. ce que tu as fait, ce que tu attendais, ce qui s'est passé ;
4. une capture d'écran.

Gravité : **bloquant** (empêche le lancement), **majeur** (gêne fortement), **mineur** (cosmétique).

## Matrice appareils et langues

À parcourir au moins une fois chacun :

| Appareil | Navigateur | Langues |
| --- | --- | --- |
| Ordinateur | Chrome, Firefox ou Safari | FR, EN |
| Tablette | Safari (iPad) ou Chrome | FR, ES |
| Smartphone | Safari (iPhone) et Chrome (Android) | FR, AR (lecture de droite à gauche) |

## A. Candidat

- [ ] **C-01 Inscription.**
  - Erreurs claires : mots de passe différents, e-mail déjà utilisé, domaine qui ne reçoit pas d'e-mail.
  - Contrôle anti-robot actif.
  - E-mail de confirmation reçu ; le lien connecte le compte.
- [ ] **C-02 Connexion et déconnexion.** Un mauvais mot de passe affiche un message clair. Le menu du compte permet de se déconnecter.
- [ ] **C-03 Mot de passe oublié.** E-mail reçu, nouveau mot de passe enregistré, connexion avec ce mot de passe.
- [ ] **C-04 Profil.** Titre, ville, pays, compétences enregistrés et affichés.
- [ ] **C-05 CV.**
  - Dépôt d'un PDF (4 Mo au plus) ; refus d'un fichier non valide.
  - Relecture de la version anonymisée, puis validation.
- [ ] **C-06 Recherche.**
  - Mots-clés, filtres (pays, ville, télétravail, contrat, expérience) et pagination.
  - Message clair quand il n'y a aucun résultat.
- [ ] **C-07 Fiche d'offre.**
  - Informations complètes, lien vers l'entreprise, offres similaires.
  - Signalement d'une offre, connecté et non connecté.
- [ ] **C-08 Candidature.**
  - Accord de transmission demandé la première fois, candidature confirmée.
  - Une seconde candidature à la même offre est refusée.
- [ ] **C-09 Suivi.**
  - Statuts des candidatures.
  - Demande de dévoilement d'identité par un recruteur : accepter, refuser, puis retirer l'accès.
- [ ] **C-10 Favoris.** Ajouter, retrouver dans la liste, retirer.
- [ ] **C-11 Alertes emploi.** Créer, recevoir l'e-mail du lendemain matin, désactiver.
- [ ] **C-12 Notifications.** E-mails reçus aux bonnes étapes, dans la langue du compte.
- [ ] **C-13 Données personnelles.** Export des données (fichier JSON), demande RGPD.
- [ ] **C-14 Suppression du compte.** Compte supprimé, CV supprimés, candidatures anonymisées.

## B. Recruteur

- [ ] **R-01 Inscription.** Avec un e-mail professionnel, confirmation par e-mail.
- [ ] **R-02 Entreprise.**
  - Numéro officiel invalide refusé, numéro valide accepté.
  - Vérification automatique ou manuelle.
- [ ] **R-03 Justificatif.** Dépôt d'un document de vérification si demandé.
- [ ] **R-04 Page entreprise publique.** Logo, description, offres en cours.
- [ ] **R-05 Création d'annonce.**
  - Une annonce incomplète est refusée avec les raisons.
  - Une mention discriminatoire envoie l'annonce en modération humaine.
  - Aperçu disponible.
- [ ] **R-06 Paiement accepté (carte 4242).**
  - Récapitulatif à 5,95 € HT par mois, case des conditions recruteurs obligatoire.
  - Page Stripe **en euros**.
  - Retour sur « Paiement confirmé : annonce publiée », annonce visible publiquement, e-mail reçu.
- [ ] **R-07 3D Secure (carte 4000 0027 6000 3184).**
  - Défi validé : annonce publiée.
  - Défi refusé (autre annonce) : annonce non publiée.
- [ ] **R-08 Carte refusée (9995).** Message de Stripe, annonce non publiée. Nouvel essai avec 4242 : publiée.
- [ ] **R-09 Modification d'une annonce publiée.** Enregistrée ; nouvelle modération si le texte devient douteux.
- [ ] **R-10 Candidatures reçues.**
  - Anonymes (alias) ; CV anonymisé consultable ; changement de statut.
  - Demande de dévoilement ; identité et CV d'origine visibles seulement après accord du candidat.
- [ ] **R-11 Facturation.** Factures téléchargeables (PDF). Portail Stripe : changer de carte, voir les factures.
- [ ] **R-12 Résiliation depuis le portail.** L'annonce reste en ligne jusqu'à la fin de la période payée.
- [ ] **R-13 Clôture d'une annonce depuis l'espace recruteur.** Le renouvellement est arrêté.
- [ ] **R-14 Renouvellement.** Avec une horloge de test Stripe (voir STRIPE_TESTING.md) : deuxième facture payée.
- [ ] **R-15 Échec de renouvellement (carte 0341).**
  - E-mail d'échec, délai de grâce de 3 jours.
  - Suspension après le délai, retour en ligne après paiement.
- [ ] **R-16 Remboursement.** Après un remboursement fait par l'administration, le montant remboursé est visible.
- [ ] **R-17 Paramètres et suppression du compte.**

- [ ] **R-18 Pendant l'offre de lancement**, R-06 à R-08 (paiement direct) se testent sur une annonce dont la gratuité est terminée (voir L-04), ou avec la conversion (L-03).

## E. Offre de lancement (jusqu'au 31/12/2026)

- [ ] **L-01 Bandeau.**
  - Accueil, page recruteurs et tableau de bord recruteur : « Offre de lancement : publiez gratuitement vos annonces jusqu'au 31 décembre 2026. » et le tarif normal de 5,95 € HT à compter du 1er janvier 2027.
  - Absent de la recherche d'emploi et des pages d'offre. Lisible sur mobile, en arabe et en thème sombre.
- [ ] **L-02 Publication gratuite.** Nouvelle annonce d'une entreprise vérifiée : « Annonce publiée gratuitement », aucune carte demandée, annonce visible et ouverte aux candidatures. Une mention discriminatoire passe toujours en modération.
- [ ] **L-03 Conversion.**
  - Bouton « Garder en ligne après l'offre » ; page de paiement : « Aucun prélèvement avant le 1er janvier 2027 », case d'autorisation obligatoire en plus des conditions.
  - Page Stripe : période d'essai jusqu'à la fin de l'offre, rien à payer aujourd'hui (carte 4242).
  - Retour : « Abonnement enregistré », puis « premier prélèvement le 1er janvier 2027 » sur la page de l'annonce.
- [ ] **L-04 Fin d'offre simulée** (préproduction uniquement, ne jamais le faire en production).
  1. Back-office → Paramètres → `billing.free_publication_until` = un instant dans 5 minutes, avec fuseau (ex. `2026-12-01T10:05:00+01:00`).
  2. Publier une nouvelle annonce (elle est gratuite jusqu'à cet instant).
  3. Après l'instant : l'annonce n'est plus dans la recherche ni accessible publiquement, avant toute tâche planifiée.
  4. Lancer la maintenance (`node scripts/preprod-run-cron.mjs maintenance`) : « Annonce en pause » dans l'espace recruteur, candidatures conservées.
  5. « Réactiver l'annonce » (carte 4242) : de nouveau en ligne.
  6. Remettre le réglage à `2027-01-01T00:00:00+01:00`.
- [ ] **L-05 E-mails** (une fois Resend configuré) : rappel avant la fin et e-mail de mise en pause, dans la langue du recruteur.

## C. Administration

- [ ] **A-01 Rôles.** Un modérateur ne voit que ses sections ; un candidat est refusé ; les remboursements sont réservés à la finance.
- [ ] **A-02 Double authentification au back-office** (si livrée : voir LAUNCH_CHECKLIST, SEC-02).
- [ ] **A-03 Tableau de bord.** Indicateurs et graphiques ; revenus visibles par la finance seulement.
- [ ] **A-04 Utilisateurs.** Recherche, suspension avec motif et e-mail, réactivation, rôles.
- [ ] **A-05 Recruteurs et entreprises.** Vérification manuelle (approuver, rejeter avec motif), suspension.
- [ ] **A-06 Annonces et modération.** Approuver, refuser avec motif ; règles de modération.
- [ ] **A-07 Signalements.** Traitement et décision motivée.
- [ ] **A-08 Paiements.** Liste, événements Stripe reçus, remboursement total et partiel avec motif.
- [ ] **A-09 Abonnements.** État de l'abonnement de chaque annonce payée.
- [ ] **A-10 Tarifs.** « Créer le prix Stripe » (à faire une fois en préprod) ; nouveau tarif par pays et devise.
- [ ] **A-11 Pays.** Checklist de conformité ; publication payante bloquée sans checklist complète ou dérogation motivée.
- [ ] **A-12 E-mails.** Personnaliser un modèle par langue, puis restaurer le modèle par défaut.
- [ ] **A-13 Confidentialité.** Demandes RGPD, effacement d'un compte.
- [ ] **A-14 Journaux.** Les décisions et les accès aux CV sont journalisés.
- [ ] **A-15 Paramètres.** Interrupteur de la publicité (`ads.enabled`), identifiants des blocs (`ads.slots`), délai de grâce.
- [ ] **A-16 API Tamurt HQ.** Jeton à usage unique, données agrégées seulement, révocation.

## D. Transverse

- [ ] **T-01 Responsive.** Menu mobile, formulaires, tableaux du back-office lisibles sur téléphone.
- [ ] **T-02 Langues.** FR, EN, ES, AR : textes, dates, montants ; mise en page de droite à gauche en arabe.
- [ ] **T-03 Thèmes.** Clair et sombre.
- [ ] **T-04 Accessibilité.** Navigation au clavier, lien « Aller au contenu », focus visible.
- [ ] **T-05 Sécurité.**
  - Une URL privée sans connexion renvoie vers la connexion.
  - Un recruteur ne voit pas les candidatures d'une autre entreprise.
  - Un candidat ne voit pas les CV des autres.
- [ ] **T-06 Pages d'erreur.** Page 404 claire ; retour à l'accueil.
- [ ] **T-07 Préproduction non indexée.** `/robots.txt` interdit tout ; bandeau « Préproduction » visible.
- [ ] **T-08 Publicité.** Désactivée par défaut. Une fois activée dans les paramètres (avec identifiants AdSense) :
  - emplacements étiquetés « Publicité » sur les pages publiques seulement ;
  - lien « Paramètres des cookies » en bas de page.
- [ ] **T-09 E-mails.** Expéditeur, objet, liens et langue corrects ; pas de spam.
- [ ] **T-10 Anti-robot avec les vraies clés Turnstile et la protection CAPTCHA de Supabase active.**
  - **Prérequis : une seule paire de clés.** Le widget Cloudflare dont la clé de site est compilée dans la préproduction (elle commence par `0x4AAAAAAG`) a **une** clé secrète. Elle doit être saisie à l'identique :
    - dans Vercel (`TURNSTILE_SECRET_KEY`), pour le signalement anonyme ;
    - dans Supabase → Authentication → Attack Protection → Turnstile, pour la connexion, l'inscription, le mot de passe oublié et le renvoi.

    Je peux le contrôler sans afficher aucun secret, en comparant leurs empreintes SHA-256 (l'API de Supabase ne renvoie que l'empreinte).
  - **Constat du 28/11 (cause de l'échec de connexion avec « Succès ! »)** :
    - la clé de site compilée est bien celle de Vercel ;
    - le secret de Vercel est valide et fonctionne (signalement) ;
    - le secret enregistré dans Supabase est un secret Turnstile **valide** : un jeton forgé y est refusé avec `invalid-input-response`, et non `invalid-input-secret` ;
    - mais son empreinte **diffère** de celle du secret de Vercel.

    C'est donc le secret d'un autre widget (ou d'une autre génération de clé). Les jetons du widget affiché sont refusés, quel que soit le compte, administrateur compris. Correction : coller dans Supabase la clé secrète du widget `0x4AAAAAAG…`.
  - **Dans une fenêtre privée**, sur `https://tamurt-jobs-preprod.vercel.app/fr/login` :
    1. le bouton « Se connecter » reste grisé, sous « Vérification anti-robot en cours… », jusqu'au « Succès ! » du widget ;
    2. connexion d'un compte de recette candidat, recruteur, puis administrateur : l'espace s'ouvre (pour l'administrateur, le code de l'application d'authentification est ensuite demandé) ;
    3. « Mot de passe oublié » et inscription vers **ton** adresse. Sans SMTP, Supabase n'envoie qu'aux membres de ton équipe, au plus 2 e-mails par heure ([EMAIL.md](EMAIL.md) § 3.3).
  - **En cas de refus**, la préproduction (jamais la production) ajoute au message le code renvoyé par Cloudflare :

    | Code après « Détail technique » | Cause | Que faire |
    | --- | --- | --- |
    | `invalid-input-response` | jeton refusé avec le secret enregistré dans Supabase : ce n'est pas le secret du widget affiché | coller dans Supabase la clé secrète du widget `0x4AAAAAAG…` |
    | `invalid-input-secret` | le secret enregistré dans Supabase n'est pas une clé secrète Turnstile valide | idem |
    | `timeout-or-duplicate` (message « a expiré ou a déjà servi ») | jeton de plus de 300 secondes, ou déjà utilisé | rien : le widget se relance seul, réessayer au « Succès ! » |
    | message « Attendez la fin de la vérification » | aucun jeton dans le formulaire | attendre le « Succès ! » |

  - Si la connexion reste bloquée, la protection peut être désactivée **temporairement** dans Supabase (effet immédiat), le temps de corriger le secret, puis réactivée.
  - Contrôle automatique sur la préproduction réelle : `tests/preprod/captcha-enforced.spec.ts`. Il vérifie que, sans jeton, aucun envoi n'est possible. Avec un jeton forgé, Supabase doit le refuser après avoir interrogé Cloudflare, avec le code `invalid-input-response`. Le code `invalid-input-secret` signalerait un secret invalide dans Supabase. Le vrai défi de Cloudflare n'est jamais résolu automatiquement : le parcours réussi reste une vérification manuelle.
