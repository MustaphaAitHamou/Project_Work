# Conservation des données

Durées **effectivement appliquées par le code** (tâche planifiée `/api/cron/maintenance` → `public.run_maintenance()`, exécutée toutes les heures) et durées **restant à définir**. Les durées réglables sont modifiables dans `/admin/settings` (`platform_settings`). Toute durée doit être validée par le conseil en protection des données, pays par pays.

| Données | Règle appliquée | Mécanisme |
|---|---|---|
| Compte, profil, préférences | jusqu'à la suppression par l'utilisateur ou sur demande traitée par l'équipe | suppression de l'utilisateur d'authentification et cascade sur les données liées |
| CV (versions) | effacés lors de la suppression du compte ; versions remplacées ou supprimées effacées dès qu'aucune candidature en cours ne les utilise | maintenance (étape 5) + suppression du compte |
| Candidatures | anonymisées **24 mois** après la clôture/l'expiration/le refus de l'annonce, et au plus tard **36 mois** après leur envoi (`retention.applications_months`) ; inaccessibles au recruteur dès le retrait ou la suppression du compte | maintenance (étape 4), RLS |
| Justificatifs de vérification | supprimés **90 jours** après le dépôt (`retention.verification_documents_days`) | maintenance (étape 6) |
| Rapports de vérification | supprimés **365 jours** après leur création (`retention.verification_days`) | maintenance (étape 7) |
| Journal technique des e-mails | e-mails envoyés : 90 jours ; échecs définitifs : 30 jours | maintenance (étape 7) |
| Notifications lues | 180 jours | maintenance (étape 7) |
| Événements Stripe | contenu brut effacé après 90 jours ; identifiant et type conservés (idempotence) | maintenance (étape 7) |
| Compteurs anti-abus | 2 jours (empreintes d'IP, jamais d'IP en clair) | maintenance (étape 7) |
| Paiements, factures, remboursements | conservés (obligations comptables et fiscales) | — |

## À définir (aucune purge automatique implémentée)

| Données | Proposition à valider |
|---|---|
| Journal d'audit des actions d'administration | durée de prescription des actions concernées (par exemple 5 ans) |
| Journal des accès aux données personnelles | par exemple 12 mois glissants, ou durée de conservation des candidatures |
| Signalements d'annonces | par exemple 12 mois après traitement |
| Demandes d'exercice des droits | par exemple 3 ans (preuve du traitement) |
| Comptes inactifs | par exemple suppression après 24 mois sans connexion, précédée d'un e-mail d'avertissement |
| Factures | durée légale par pays (par exemple 10 ans en France) |

Chacune de ces règles nécessite une décision, une mise à jour de la politique de confidentialité et l'ajout d'une étape à `run_maintenance()` (avec un test d'intégration).
