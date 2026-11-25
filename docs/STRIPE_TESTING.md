# Stripe : tests réels en mode test, configuration et passage en live

Ce document décrit :
- comment Tamurt Jobs est testé contre le **vrai environnement de test Stripe** ;
- la configuration à faire dans le tableau de bord Stripe ;
- la procédure de passage en live.

**Rien n'est activé en live sans l'accord explicite du propriétaire.**

## 1. Ce qui est vérifié automatiquement

Le fichier `tests/e2e/stripe-real.spec.ts` n'utilise aucun mock. Les tarifs, sessions Checkout, clients, moyens de paiement, abonnements, factures, horloges de test (test clocks) et remboursements sont de vrais objets Stripe, créés en mode test.

| Parcours | Vérifié |
| --- | --- |
| Tarif créé depuis le back-office (rôle finance) | 5,95 € HT par mois, hors taxe (`exclusive`), en euros, actif |
| Session Checkout ouverte par l'application | abonnement à 5,95 € en euros, métadonnées de l'annonce, client Stripe de l'entreprise, prix synchronisé ; acceptation des conditions recruteurs obligatoire |
| Double paiement | une seconde tentative fait expirer la session précédente |
| Paiement accepté | l'annonce n'est activée que par les webhooks du paiement réel ; paiement enregistré ; annonce publique |
| Renouvellement (horloge de test) | second paiement ; la date « payé jusqu'au » avance |
| Échec de renouvellement | abonnement `past_due`, délai de grâce, motif réel du refus enregistré ; annonce toujours en ligne |
| Fin du délai de grâce | la tâche de maintenance suspend l'annonce, qui n'est plus publique |
| Régularisation | facture payée avec une carte valide, annonce réactivée |
| Résiliation en fin de période | annonce en ligne jusqu'au terme, puis expirée |
| Remboursement depuis le back-office | remboursement Stripe réel, enregistré sur le paiement |
| 3D Secure exigé | l'annonce reste non publiée tant que le paiement n'est pas confirmé |
| Carte refusée (fonds insuffisants) | aucun abonnement, annonce non publiée |

**Limite connue de l'environnement de développement.** Le proxy de la session cloud injecte la clé secrète dans toutes les requêtes vers `api.stripe.com`, y compris celles du navigateur. Stripe refuse alors la saisie de carte faite sur la page Checkout (« Sending credit card numbers directly to the Stripe API is generally unsafe »). Conséquences :
- la saisie de carte et le défi 3D Secure sur la page Stripe sont vérifiés **à la main en préproduction** (section 3) ;
- dans les tests automatiques, l'abonnement est créé par l'API exactement comme Checkout le crée : même client, même prix, mêmes métadonnées.

### Lancer les tests

```bash
npm run supabase:start
```

```bash
npm run build
```

Serveur de l'application, avec la clé de test (ou un substitut si un proxy injecte la clé) :

```bash
STRIPE_SECRET_KEY=sk_test_... STRIPE_HTTP_CLIENT=fetch npm run start -- --port 3000
```

Relais des événements Stripe vers le webhook local (équivalent de `stripe listen`) :

```bash
STRIPE_SECRET_KEY=sk_test_... STRIPE_HTTP_CLIENT=fetch node --env-file=.env.local scripts/stripe-forward-events.mjs
```

Tests :

```bash
STRIPE_REAL=1 STRIPE_SECRET_KEY=sk_test_... E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/stripe-real.spec.ts --trace off
```

Derrière un proxy HTTPS (session cloud), ajouter `NODE_USE_ENV_PROXY=1` aux trois commandes.

## 2. Configuration Stripe (mode test, puis live)

| Réglage | Où | Valeur |
| --- | --- | --- |
| Tarif | Back-office Tamurt Jobs → Tarifs → « Créer le prix Stripe » | 5,95 € HT par mois |
| Webhook | Stripe → Développeurs → Webhooks | URL `https://<domaine>/api/stripe/webhook`, version d'API `2026-10-28.endive`, événements listés dans `docs/DEPLOYMENT.md` |
| Secret du webhook | Vercel → variables d'environnement | `STRIPE_WEBHOOK_SECRET` (jamais dans le dépôt ni le chat) |
| Portail client | Stripe → Paramètres → Facturation → Portail client | factures, moyen de paiement, résiliation **en fin de période** ; changement d'offre désactivé ; liens vers les CGV et la politique de confidentialité |
| Relances | Stripe → Paramètres → Facturation → Abonnements et e-mails → Gérer les échecs de paiement | Smart Retries sur 1 semaine, puis **annuler l'abonnement**. L'annonce est suspendue après 3 jours (`billing.grace_days`), puis expire quand Stripe annule. |
| E-mails Stripe aux clients | même page | e-mails d'échec de paiement et de carte expirant activés |
| Moyens de paiement | Stripe → Paramètres → Moyens de paiement | carte bancaire (et Link). Désactiver ceux qui ne conviennent pas à des entreprises (par exemple Satispay, Amazon Pay) |
| Conversion de devise (Adaptive Pricing) | désactivée par l'application à chaque session | le prix affiché sur Tamurt Jobs est celui payé, en euros |
| Factures | Stripe → Paramètres → Facturation → Factures | identité de l'entreprise, numérotation, mentions légales et TVA : **à fournir par le propriétaire et le comptable** |
| Stripe Tax | Stripe → Paramètres → Taxes | selon la décision du comptable (`STRIPE_AUTOMATIC_TAX`) |

## 3. Cartes de test pour la recette manuelle (préproduction uniquement)

Date d'expiration : n'importe quelle date future. Code de sécurité : trois chiffres quelconques. Source : [docs.stripe.com/testing](https://docs.stripe.com/testing).

| Carte | Résultat attendu |
| --- | --- |
| 4242 4242 4242 4242 | Paiement accepté, annonce publiée |
| 4000 0025 0000 3155 | Authentification 3D Secure demandée au premier paiement ; renouvellements sans nouvelle authentification |
| 4000 0027 6000 3184 | 3D Secure exigé à chaque paiement (les renouvellements automatiques échouent) |
| 4000 0000 0000 9995 | Refus : fonds insuffisants |
| 4000 0000 0000 0002 | Refus générique |
| 4000 0000 0000 0069 | Refus : carte expirée |
| 4000 0000 0000 0341 | Carte enregistrée, mais tous les prélèvements échouent (tester un échec de renouvellement) |

Pour simuler un renouvellement en préproduction, utiliser une horloge de test dans le tableau de bord Stripe (Facturation → Horloges de test). Elle s'applique à un client créé sur cette horloge.

## 4. Passage en live (samedi, après accord)

1. Vérifier l'activation du compte Stripe live : identité, compte bancaire, informations de facturation.
2. Mettre en production `STRIPE_SECRET_KEY` (clé live) et `STRIPE_WEBHOOK_SECRET` (secret du webhook live), **dans Vercel uniquement**.
3. Créer le webhook live (même URL, même version d'API, mêmes événements).
4. Créer le tarif live depuis le back-office de production.
5. Configurer le portail client, les relances, les e-mails et les moyens de paiement en live (les réglages de test ne sont pas copiés).
6. Vérifier `/api/health` : `stripe.mode = live`, aucun problème signalé.
7. Paiement réel de contrôle (5,95 €), puis remboursement depuis le back-office.
