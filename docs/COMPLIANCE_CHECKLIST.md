# Checklist de conformité internationale

**Document de travail, non juridique.** Il recense les questions à faire trancher par un conseil local **avant** d'ouvrir la publication payante dans chaque pays. Les références citées sont indicatives et doivent être confirmées ; aucune autorisation, certification ou agrément n'est présumé acquis. La création d'une LLC aux États-Unis ne dispense d'aucune obligation locale.

Dans l'application, chaque marché dispose de la même checklist de 14 points (`/admin/countries/<code>`), dont 11 bloquants. La publication payante d'un pays ne peut être activée qu'une fois les points bloquants traités, ou par une dérogation motivée et journalisée. À la livraison, **la publication payante est désactivée dans les neuf pays** (elle n'est ouverte en France et en Belgique que dans la base locale de développement).

## Points communs à tous les marchés

| Point (clé) | Bloquant | Question à trancher |
|---|---|---|
| Présence juridique et fiscale (`business_presence`) | oui | Faut-il une entité, un établissement ou un représentant local pour exercer ? |
| Réglementation du placement (`placement_regulation`) | oui | La publication payante d'offres et la transmission de candidatures relèvent-elles d'une activité de placement ou d'agence d'emploi soumise à déclaration, licence ou agrément ? |
| Règles des offres d'emploi (`job_ad_rules`) | oui | Mentions interdites (discrimination, âge…), mentions obligatoires (rémunération dans certains pays/États), langue, durée de publication. |
| Exigences linguistiques (`language_requirements`) | oui | Langue obligatoire des offres, des CGU/CGV et des communications. |
| Protection des données (`data_protection`) | oui | Loi applicable, bases légales, registre, analyse d'impact, durées, droits, information. |
| Transferts de données (`data_transfers`) | oui | Encadrement des transferts vers les États-Unis et les sous-traitants (Supabase, Vercel, Stripe, fournisseur d'e-mail, Cloudflare). |
| Représentant / délégué (`privacy_representative`) | oui | Représentant local (UE, Royaume-Uni, Suisse), délégué à la protection des données, déclarations auprès de l'autorité. |
| Conditions commerciales (`commercial_terms`) | oui | CGV recruteurs, renouvellement automatique, résiliation, droit de rétractation éventuel des petites entreprises. |
| Fiscalité (`tax_registration`) | oui | Immatriculation TVA/TPS/taxes de vente, taux, autoliquidation, mentions de facture ; configuration de Stripe Tax. |
| Paiement et devise (`payments_currency`) | oui | Disponibilité de Stripe pour les clients du pays, devise de facturation, contrôle des changes. |
| Cookies et commerce électronique (`cookies_ecommerce`) | oui | Traceurs, mentions légales, statut d'hébergeur ou de plateforme (par exemple règlement européen sur les services numériques). |
| Facturation électronique (`e_invoicing`) | non | Obligations de facture électronique. |
| Accessibilité (`accessibility`) | non | Exigences légales d'accessibilité numérique. |
| Marque (`trademark`) | non | Disponibilité et dépôt de la marque. |

## Points d'attention par pays (à confirmer)

### France
- Offres d'emploi : interdiction des mentions discriminatoires et des limites d'âge, rédaction en français (Code du travail, notamment articles L.1132-1 et L.5331-1 et suivants) ; vérifier le régime des opérateurs privés de placement (articles L.5321-1 et suivants).
- RGPD et loi Informatique et Libertés (CNIL) ; représentant dans l'UE si aucun établissement dans l'Union.
- TVA sur les prestations de services électroniques (autoliquidation entre professionnels, guichet unique) ; calendrier de la facturation électronique.
- Règlement (UE) 2022/2065 sur les services numériques : point de contact, traitement des signalements, motivation des décisions.

### Belgique
- Législation anti-discrimination fédérale et régionale ; règles linguistiques selon la région.
- Agences d'emploi privées : régimes régionaux (Bruxelles-Capitale, Wallonie, Flandre) à analyser pour un site d'offres d'emploi.
- RGPD (Autorité de protection des données).

### Luxembourg
- Code du travail, règles relatives aux offres d'emploi et au placement (ADEM) à analyser.
- RGPD (CNPD) ; TVA.

### Espagne
- Statut d'« agencia de colocación » et formalités auprès du service public de l'emploi à analyser.
- RGPD et LOPDGDD (AEPD) ; langues co-officielles selon les communautés autonomes.

### Suisse
- Loi sur le service de l'emploi et la location de services (LSE) : déterminer si l'activité constitue du placement soumis à autorisation (SECO, cantons).
- nLPD (PFPDT) : représentant en Suisse le cas échéant, transferts vers les États-Unis.
- TVA suisse pour les prestations électroniques fournies par une entreprise étrangère.

### Royaume-Uni
- UK GDPR et Data Protection Act 2018 (ICO) : redevance de protection des données, représentant au Royaume-Uni.
- Employment Agencies Act 1973 et Conduct Regulations 2003 : qualification d'un site d'offres d'emploi, interdiction de facturer les candidats.
- Equality Act 2010 pour le contenu des offres ; TVA britannique sur les services numériques.

### Canada
- LPRPDE (fédéral) et lois provinciales ; au Québec, Loi 25 (responsable de la protection des renseignements personnels, évaluation des facteurs relatifs à la vie privée avant communication hors Québec) et Charte de la langue française (offres en français).
- Licences d'agences de placement ou de recruteurs selon les provinces.
- TPS/TVH et taxes provinciales sur les services numériques fournis par des non-résidents.

### États-Unis
- Lois fédérales anti-discrimination applicables au contenu des offres ; lois d'États sur la transparence salariale (fourchette de salaire obligatoire dans certaines offres).
- Lois d'États sur la vie privée (par exemple Californie) selon les seuils.
- Licences d'agence d'emploi dans certains États ; taxes de vente sur les services numériques selon les États.

### Algérie
- Loi n° 18-07 relative à la protection des données à caractère personnel : formalités préalables auprès de l'Autorité nationale (ANPDP), régime des transferts à l'étranger.
- Placement des travailleurs (loi n° 04-19) : agrément des organismes privés de placement à analyser.
- Commerce électronique (loi n° 18-05) : conditions imposées aux fournisseurs électroniques (inscription, hébergement, nom de domaine) à analyser pour un service transfrontière.
- Réglementation des changes et capacité des entreprises à payer en ligne ; disponibilité de Stripe et de la devise DZD à confirmer.
- Aucun registre des entreprises interrogeable automatiquement n'est intégré : vérification manuelle sur extrait du registre du commerce (CNRC).

## Points techniques déjà en place pour faciliter la conformité

- Aucune photo, aucune collecte de nationalité ou d'origine ; contrôle des formulations discriminatoires avec revue humaine.
- Candidature directement sur la plateforme, gratuite pour les candidats ; aucune messagerie.
- Export, rectification et suppression des données en libre-service ; demandes suivies avec échéance ; journal des accès aux CV.
- Textes juridiques en projet, avec bandeau, en français et en anglais ; à traduire et adapter par pays.
- Prix affichés hors taxes ou toutes taxes comprises selon le tarif ; calcul des taxes dépendant de Stripe Tax (désactivé par défaut et signalé en production).
