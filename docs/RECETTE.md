# Recette manuelle — Tamurt Jobs (préproduction)

But : utiliser le site comme un candidat, un recruteur payant et un administrateur, sur chaque appareil et dans chaque langue, avant le GO / NO GO du lancement.

## Avant de commencer

- **URL de préproduction :** voir [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) (PRE-01).
  - Le site demande un identifiant et un mot de passe de préproduction (`PREPROD_BASIC_AUTH`). Tu les as choisis et saisis toi-même dans Vercel.
- **Comptes de test :** ils sont créés par `scripts/preprod-seed.mjs` (candidat, recruteur vérifié, administrateur) et leur liste est fournie à la livraison.
  - Ils n'existent qu'en préproduction.
  - Les données de démonstration sont marquées comme fictives.
- **Paiements :** mode test Stripe uniquement. Les cartes de test sont dans [STRIPE_TESTING.md](STRIPE_TESTING.md) (section 3). Aucune vraie carte.
- **E-mails :** ils arrivent dans la boîte de l'adresse utilisée. Pour les comptes de démonstration, se connecter avec les identifiants fournis.

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
- [ ] **T-10 Anti-robot avec les vraies clés Turnstile** (à faire **avant** d'activer « Enable Captcha protection » dans Supabase, puis juste après).
  1. Ouvrir `/fr/login` dans un navigateur normal : le widget Cloudflare s'affiche, sans message « domaine non autorisé », et se valide (coche verte, parfois après un clic).
  2. Fiche d'une offre « (démo) » → **Signaler**, sans être connecté → envoyer. Le message « Merci, votre signalement a été transmis » prouve que la clé de site et la clé secrète du serveur forment bien une paire. La clé secrète est celle de `TURNSTILE_SECRET_KEY`.
  3. Activer la protection dans Supabase avec **la même clé secrète**, puis, dans une fenêtre privée :
     - se connecter avec un compte de recette ;
     - tester « Mot de passe oublié » ;
     - tester l'inscription d'une adresse réelle.

     Tout doit passer.
  4. En cas de refus (« La vérification anti-robot a échoué ») : désactiver l'option dans Supabase, ce qui prend effet immédiatement, puis le signaler.

  Les tests automatiques `tests/preprod/turnstile.spec.ts` ne peuvent pas faire ces vérifications avec les vraies clés. Cloudflare présente un défi interactif aux navigateurs automatisés, par conception. Les lancer avec `PREPROD_TURNSTILE_KEYS=real` pour les ignorer proprement.
