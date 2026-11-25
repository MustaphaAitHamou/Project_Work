# Conformité du lancement — proposition pays par pays

Ce document prépare les décisions du propriétaire pour le lancement du samedi 28 novembre 2026. **Il ne remplace pas l'avis d'un juriste**. Il ne valide aucune checklist et ne contient aucune information administrative inventée.

## 1. Où en est la plateforme

- **Neuf marchés** sont prévus : France, Belgique, Luxembourg, Espagne, Suisse, Royaume-Uni, Canada, États-Unis, Algérie.
- **Publication payante désactivée partout** dans une base hébergée neuve. Chaque marché a une checklist de 14 points, dont 11 bloquants (back-office → Pays → `<code>` ; détail dans [COMPLIANCE_CHECKLIST.md](COMPLIANCE_CHECKLIST.md)).
- Pour ouvrir un marché, deux voies seulement :
  - la checklist est complétée par le propriétaire avec son conseil (statut, notes, lien vers la preuve) ;
  - le propriétaire enregistre une **dérogation motivée** (30 caractères au moins), conservée dans le journal d'audit.

  C'est une décision du propriétaire. Je ne la prends pas et je ne remplis pas les checklists.
- Les candidats peuvent s'inscrire et consulter les offres quel que soit leur pays. La publication dépend du pays du poste et du pays d'immatriculation de l'entreprise.

## 2. Proposition de lancement progressif

| Étape | Marchés | Condition |
| --- | --- | --- |
| Samedi 28/11 | **France** uniquement, entreprises immatriculées en France | Checklist France traitée avec le conseil, ou dérogation motivée assumée par le propriétaire ; mentions légales complètes (identité de l'éditeur) |
| Ensuite | Belgique, Luxembourg | Mêmes règles UE ; règles linguistiques régionales (Belgique) et régimes régionaux des agences d'emploi à analyser |
| Ensuite | Espagne, Suisse | Langue (castillan), LPD suisse et représentant en Suisse ; consentement publicitaire pour la Suisse |
| Ensuite | Royaume-Uni | UK GDPR, représentant au Royaume-Uni, PECR (cookies) |
| Ensuite | Canada, États-Unis | Loi 25 au Québec, transparence salariale selon les États ou provinces, taxes de vente |
| En dernier | Algérie | Loi 18-07 : autorisation préalable de l'autorité pour les transferts de données depuis l'Algérie ; paiement des entreprises algériennes |

**Textes à adapter si seule la France ouvre.** Le site annonce « Offres d'emploi dans 9 pays » dans :
- la description du site (`meta.description`) ;
- le bandeau de l'accueil ;
- la page recruteurs.

Proposition : « en France » au lancement, puis élargir au fil des ouvertures. Décision commerciale du propriétaire.

## 3. Points bloquants pour la France

| Point | Ce qui est prêt dans le produit | À décider ou faire valider |
| --- | --- | --- |
| Présence juridique et fiscale | — | **Qui vend ?** Le compte Stripe est français ; les textes nomment Tamurt Services LLC (États-Unis). L'entité doit être la même partout : mentions légales, CGV, factures, Stripe. |
| Réglementation du placement | Service gratuit pour les candidats ; aucune commission sur les salaires | La publication payante d'offres et la transmission de candidatures relèvent-elles du régime des opérateurs privés de placement (Code du travail, art. L.5321-1 et suivants) ? |
| Règles des offres d'emploi | Mentions discriminatoires signalées à un modérateur ; employeur nommé ; offres datées | Validation des contrôles au regard des art. L.1132-1 et L.5331-1 et suivants ; langue française des offres |
| Exigences linguistiques | Interface et textes en français | — |
| Protection des données | Registre des traitements, durées de conservation documentées (`DATA_RETENTION.md`), export et effacement | Analyse d'impact (CV, volume) ; validation des durées |
| Transferts de données | Région d'hébergement UE recommandée (Paris) | Encadrement des sous-traitants américains (Supabase, Vercel, Stripe, Resend, Cloudflare, Google) |
| Représentant et délégué | — | Représentant dans l'UE (RGPD, art. 27) si l'entité n'a pas d'établissement dans l'UE ; délégué à la protection des données si nécessaire |
| Conditions commerciales | CGV recruteurs : abonnement mensuel, sans engagement, résiliation en fin de période, échecs de paiement, suspension | Politique de remboursement (section 5) ; droit de rétractation des petites entreprises ; information préalable en cas de hausse de prix |
| Fiscalité | Prix hors taxes, numéro de TVA du client collecté au paiement, Stripe Tax prêt à activer | Régime de TVA selon l'entité vendeuse ; autoliquidation ; mentions de facture |
| Paiement et devise | Stripe Checkout en euros, sans conversion de devise | Activation du compte live au nom de la bonne entité |
| Cookies et commerce électronique | Seulement des cookies nécessaires ; publicité soumise au consentement (CMP certifiée de Google) | Validation de la politique cookies mise à jour ; statut d'hébergeur ou de plateforme au sens du DSA |

## 4. Questions pour le juriste

1. Quelle entité exploite et vend (LLC américaine ou structure française) ? Quelles conséquences pour les mentions légales, la TVA, la facturation et le RGPD ?
2. Tamurt Jobs relève-t-il du régime des opérateurs privés de placement (art. L.5321-1 et suivants) ? Faut-il une déclaration ?
3. Les contrôles des offres (mentions discriminatoires, langue, identité de l'employeur) suffisent-ils pour les art. L.1132-1 et L.5331-1 et suivants ?
4. Faut-il un représentant dans l'UE (art. 27 RGPD) et un délégué à la protection des données ? Faut-il une analyse d'impact ?
5. Quel encadrement des transferts vers les sous-traitants américains (DPF, clauses contractuelles types) ?
6. Les 42 passages « à compléter / à valider » de `content/legal/fr/`, en particulier :
   - l'âge minimal d'inscription ;
   - la limitation de responsabilité ;
   - la médiation de la consommation ;
   - le droit applicable.
7. Obligations du règlement sur les services numériques : point de contact, motivation des décisions (l'auteur d'un signalement est désormais informé de la décision), recours.
8. Politique de remboursement (section 5) et droit de rétractation des petites entreprises.
9. Politique cookies avec publicité : rédaction, durée de conservation du consentement, rôle de Google.
10. Disponibilité et dépôt de la marque « Tamurt Jobs » (non bloquant).

## 5. Politique de remboursement — proposition à valider

Comportement actuel du produit :
- la résiliation arrête le renouvellement et l'annonce reste en ligne jusqu'à la fin de la période payée ;
- les remboursements sont manuels, depuis le back-office, réservés au rôle finance, avec motif obligatoire et journalisation.

Rédaction proposée pour l'article 5 des conditions recruteurs. **Elle n'est pas encore dans les textes : c'est ta décision.**

> « La période en cours n'est pas remboursée en cas de résiliation ou de clôture à l'initiative de l'entreprise. Elle est remboursée intégralement en cas de double paiement, d'erreur technique imputable à Tamurt Jobs, ou de retrait de l'annonce par Tamurt Jobs pour un motif qui n'est pas imputable à l'entreprise. Une annonce suspendue ou retirée pour manquement aux présentes Conditions n'ouvre pas droit à remboursement. »
