# Publicité Google AdSense — Tamurt Jobs

## Quel produit Google ?

| Produit | Rôle | Pour Tamurt Jobs |
| --- | --- | --- |
| **Google Ads** | **Acheter** de la publicité (promouvoir Tamurt Jobs sur Google) | Ne rapporte rien. Aucune campagne n'est lancée sans accord du propriétaire. |
| **Google AdSense** | **Vendre** des emplacements sur son site ; Google choisit les annonceurs et reverse une part des revenus | **Produit retenu.** |
| **Google Ad Manager** | Serveur publicitaire pour gros éditeurs (ventes directes, plusieurs régies) | Plus tard, si le trafic le justifie. |

## Ce que fait le code

- **Emplacements :** un emplacement par page publique (accueil, recherche, fiche d'offre, liste et page des entreprises). Chacun est étiqueté « Publicité ».
- **Jamais de publicité :**
  - dans les espaces candidat, recruteur et administration ;
  - sur la connexion, l'inscription, le paiement et les pages juridiques ;
  - dans la liste des offres. Le classement reste « sans annonce sponsorisée », comme le promet le site.
- **Formats :** blocs adaptatifs (`data-ad-format="auto"`, pleine largeur sur mobile), pour l'ordinateur comme pour le téléphone.
- **Pas de décalage de mise en page :** une hauteur de 280 px est réservée avant le chargement. L'emplacement disparaît si Google n'a pas d'annonce à afficher.
- **Chargement optimisé :** le script AdSense ne se charge que sur les pages qui ont un emplacement, après l'interactivité de la page. Chaque bloc n'est demandé que lorsqu'il approche de l'écran.
- **Consentement :** la plateforme de gestion du consentement (CMP) de Google, certifiée et intégrée au TCF de l'IAB, s'affiche avec le script AdSense. Google l'exige pour l'EEE, le Royaume-Uni et la Suisse.
  - Sans consentement, Google ne sert que des annonces non personnalisées ou limitées.
  - Le lien « Paramètres des cookies », en bas de page, rouvre les choix.
- **Interrupteur :** Back-office → Paramètres → `ads.enabled` (`true` ou `false`). Les identifiants des blocs se règlent au même endroit, dans `ads.slots`.
- **Mode par environnement (`ADS_MODE`)**, en plus de l'interrupteur :

| Mode | Par défaut | Effet |
| --- | --- | --- |
| `placeholder` | préproduction et développement | Emplacements étiquetés « Emplacement publicitaire de test ». Aucun script Google ni requête à Google, et aucune annonce réelle. Fonctionne sans compte AdSense, pour vérifier la place des blocs avant l'approbation. |
| `test` | — | Vrai code AdSense avec `data-adtest="on"` : Google sert des annonces de test, ni affichages ni clics ne sont comptés. Exige l'identifiant éditeur. Sert à tester la CMP et le chargement en préproduction une fois le compte ouvert. |
| `live` | production | Annonces réelles. Un `live` demandé hors production est ramené à `test`. |
| `off` | — | Aucune publicité, quel que soit l'interrupteur. |

- Vérifié par E2E (25/11) :
  - en mode `placeholder`, aucune requête vers les serveurs publicitaires de Google ;
  - aucun emplacement dans les candidatures, l'espace recruteur, la page de paiement ni le back-office ;
  - le bouton « Postuler » reste accessible sur une fiche d'offre qui porte un emplacement.
- L'approbation du site par Google n'est **pas** simulée : elle aura lieu sur le domaine public.
- **`ads.txt` :** il est généré automatiquement à l'adresse `/ads.txt` à partir de l'identifiant éditeur.
- **Politique de sécurité (CSP) :** elle n'autorise les domaines de Google que si l'identifiant éditeur est configuré.
- **Textes :** la politique cookies et la politique de confidentialité ont été mises à jour. Les passages `[À VALIDER]` sont à faire relire par le juriste.

## Démarches à faire (propriétaire)

1. **Créer le compte AdSense** sur https://adsense.google.com avec ton compte Google, puis ajouter le site (domaine final de Tamurt Jobs).
   - AdSense est distinct de Google Ads : ton compte Google Ads ne suffit pas.
   - Le titulaire du compte reçoit les paiements. Il faut renseigner son identité et ses informations fiscales dans AdSense.
2. **Donner l'identifiant éditeur** `ca-pub-…`. Il n'est pas secret : tu peux me le donner dans le chat.
   - Je le mets dans Vercel → Settings → Environment Variables → `NEXT_PUBLIC_ADSENSE_CLIENT` (Production), puis je redéploie.
   - La balise de vérification Google et `ads.txt` seront alors en place.
3. **Si Jobs est sur un sous-domaine** (par exemple `jobs.exemple.com`), Google lit `ads.txt` sur le domaine racine. Il faut que `exemple.com/ads.txt` serve le même contenu, ou redirige vers `jobs.exemple.com/ads.txt`.
4. **Message de consentement :** AdSense → Confidentialité et messages → « Réglementations européennes ».
   - Créer le message.
   - Langues : français, anglais, espagnol (et arabe si proposé).
   - Lien vers la politique de confidentialité du site.
   - Publier pour le site.
5. **Blocs d'annonces :** AdSense → Annonces → Par bloc d'annonces → « Annonces display », format adaptatif.
   - Créer 5 blocs : `home`, `jobs`, `job`, `companies`, `company`.
   - Me donner leurs identifiants `data-ad-slot`. Ils ne sont pas secrets.
6. **Demander la validation du site** une fois le site en ligne sur son domaine final. Google la donne en quelques jours à quelques semaines ; elle n'est pas garantie. **Le lancement n'attend pas cette validation.**
7. **Une fois le site approuvé et le message publié :** Back-office → Paramètres → `ads.enabled` = `true`.

## Règles AdSense à respecter

- Ne jamais cliquer sur ses propres annonces, ni inciter à cliquer.
- Ne pas placer d'annonces dans des pages sans contenu éditorial : pages vides, connexion, erreurs.
- Ne pas confondre les annonces avec les offres d'emploi. L'étiquette « Publicité » est obligatoire et déjà présente.
