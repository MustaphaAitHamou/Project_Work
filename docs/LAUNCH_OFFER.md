# Offre de lancement — publication gratuite jusqu'au 31 décembre 2026

## 1. Règle

- Jusqu'au **31 décembre 2026 à 23 h 59 min 59 s, heure de Paris**, la publication d'une annonce est **gratuite pour toutes les entreprises**, sans carte bancaire. C'est une date de fin commune, pas un essai individuel de 30 jours.
- À partir du **1er janvier 2027 à 0 h, heure de Paris**, toute nouvelle annonce exige l'abonnement Stripe : **5,95 € HT par mois et par annonce active**.
- La vérification de l'entreprise, la checklist de conformité du pays et la modération s'appliquent pendant l'offre comme après.
- **Aucun prélèvement** n'a lieu du seul fait de la fin de l'offre. Un abonnement n'existe que si le recruteur le souscrit lui-même, avec une autorisation explicite du premier prélèvement.
- **Rien n'est supprimé** : une annonce gratuite non convertie est mise en pause (`suspended`, motif `free_period_ended`). Elle disparaît de la recherche, des pages publiques, des API publiques et des candidatures, mais reste visible avec ses candidatures dans l'espace recruteur, et se réactive en souscrivant.

## 2. Où c'est appliqué (côté serveur)

| Élément | Emplacement |
| --- | --- |
| Date de fin (borne exclue) | réglage `billing.free_publication_until` = `2027-01-01T00:00:00+01:00` (01/01/2027 00:00 Paris = 31/12/2026 23:00 UTC) ; lu par `app.free_publication_until()`, qui retombe sur cette valeur si le réglage devient illisible |
| Publication gratuite | `submit_job`, `reopen_job`, `admin_moderate_job` (validation, rétablissement) : statut `active` et `jobs.free_until` |
| Fin exacte, même si la tâche planifiée est en retard | les vues `public_jobs`, `public_companies`, `job_is_public`, `search_jobs`, `search_suggestions`, `similar_jobs` et `apply_to_job` comparent `free_until` à l'heure de la base : l'annonce disparaît **à l'instant** de la fin |
| État explicite, une seule fois | `run_maintenance` (verrou consultatif : une seule exécution à la fois ; idempotente) passe les annonces en `suspended` / `free_period_ended` et envoie l'e-mail `free_period_ended` une fois par annonce |
| Rappels | `run_maintenance` : e-mail `free_period_ending` environ 30 jours puis 7 jours avant la fin, une fois par entreprise, jalon et date de fin |
| Conversion | `billing_prepare_checkout` renvoie `trial_until` ; Stripe Checkout crée l'abonnement avec une période d'essai jusqu'à la fin de la gratuité (`trial_end`), carte obligatoire, message Stripe « Aucun prélèvement avant le… » ; consentement explicite vérifié côté serveur (`startCheckoutAction`) |
| Réactivation | `billing_prepare_checkout` accepte une annonce gratuite terminée (suspension enregistrée ou pas encore) ; le paiement confirmé par webhook la remet en ligne (`app.billing_activate_job`) |
| Modification de la date | back-office → Paramètres → `billing.free_publication_until` : valeur ISO 8601 avec fuseau obligatoire (sinon refusée). Une prolongation s'applique aux annonces déjà en ligne gratuitement ; un raccourcissement ne vaut que pour les nouvelles publications |

Tâches planifiées : sur Vercel (offre Hobby), `run_maintenance` tourne une fois par jour (`/api/cron/maintenance`, 03:07 UTC) ; sur Iglao, chaque heure. Dans les deux cas, la mise en pause publique est déjà effective à 00:00 ; la tâche ne fait qu'enregistrer l'état et prévenir l'entreprise.

E-mails : les envois groupés (rappels, alertes) passent après les e-mails transactionnels. Tant que `EMAIL_PROVIDER` vaut `none` (préproduction actuelle), **aucun e-mail n'est envoyé** : ils restent dans la file `email_outbox`. Aucun utilisateur réel n'a été contacté pendant les tests (adresses `@example.test`, boîte locale Mailpit).

## 3. Côté interface

- Bandeau « Offre de lancement : publiez gratuitement vos annonces jusqu'au 31 décembre 2026. » avec le tarif normal à compter du 1er janvier 2027 : accueil, page recruteurs, tableau de bord recruteur. Jamais sur la recherche d'emploi ni sur les offres. Il disparaît de lui-même (pages rendues à chaque requête, état lu en base).
- Tarifs (page recruteurs) : encart « Gratuit jusqu'au 31 décembre 2026 », tarif de 5,95 € HT « À compter du 1er janvier 2027 », question fréquente dédiée.
- Espace recruteur : confirmation « Annonce publiée gratuitement », état « En ligne gratuitement jusqu'au… », bouton « Garder en ligne après l'offre » ; après la fin, « Annonce en pause » et « Réactiver l'annonce ».
- Paiement : titre et texte propres à la conversion, date du premier prélèvement, case d'autorisation obligatoire.
- Les dates affichées sont calculées en heure de Paris (« 1er » en français).

## 4. Tests (horloge simulée)

L'heure des serveurs n'est jamais modifiée : les tests déplacent la date de fin (réglage) ou la fin d'une annonce (`free_until`), et utilisent les horloges de test de Stripe.

| Test | Fichier | Couvre |
| --- | --- | --- |
| Intégration (15) | `tests/integration/db/launch-free-period.test.ts` | 31/12 22:00, 23:59:59 et 01/01 00:00 (Paris) ; publication gratuite visible, cherchable, ouverte ; modération ; fin passée avant la maintenance ; mise en pause unique et idempotente ; exécutions concurrentes ; publication après la fin (paiement exigé) ; réactivation (paiement échoué puis réussi) ; abonnement juste après la fin ; conversion avec essai, webhooks en double et désordonnés ; résiliation pendant l'essai ; rappels J-30 / J-7 ; priorité des e-mails ; date de fin du back-office ; protections contre la falsification |
| Intégration | `tests/integration/db/job-billing-lifecycle.test.ts` | modèle payant de 2027 (offre simulée terminée) |
| Unitaires | `tests/unit/launch-offer.test.ts`, `tests/unit/checkout-consent.test.ts` | dates de Paris, « 1er », fin d'essai Stripe (48 h), mode de paiement selon l'état, consentement exigé côté serveur, e-mails |
| Bout en bout | `tests/e2e/launch-offer.spec.ts` | bandeau (et son absence sur la recherche), publication gratuite par l'interface, offre publique et candidature, page de conversion ; puis fin simulée : offre masquée avant toute tâche, mise en pause par la tâche planifiée, e-mail, réactivation proposée, nouvelle annonce payante |
| Stripe réel (mode test) | `tests/e2e/stripe-real.spec.ts` (`STRIPE_REAL=1`) | session Checkout acceptée avec essai ; carte 4242 : rien avant la fin, 5,95 € à la fin ; résiliation pendant l'essai : jamais prélevé ; carte refusée à la fin : impayé avec délai de grâce |

## 5. À valider avant la mise en production (propriétaire, conseil juridique)

- Clause « Offre de lancement » des conditions commerciales recruteurs (article 3), marquée **[À VALIDER]** : rédaction, information précontractuelle, règles sur les annonces promotionnelles dans chaque pays ouvert, possibilité de raccourcir l'offre.
- Choix commercial : une conversion souscrite dans les 48 dernières heures a un premier prélèvement décalé de quelques heures (contrainte Stripe : un essai finit au moins 48 h après la création de la session). Jamais avancé.
- La facturation réelle (clés Stripe live) reste soumise à l'autorisation de mise en production du propriétaire.
