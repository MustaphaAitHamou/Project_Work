# Système visuel — refonte de novembre 2026

## Typographie

| Usage | Police | Chargement |
| --- | --- | --- |
| Titres (`h1`–`h3`, `.font-display`) | **Plus Jakarta Sans** (variable, 200–800) | `next/font`, auto-hébergée, préchargée, `display: swap` avec repli local aux métriques ajustées |
| Texte et interface | **Inter** (variable) | idem |
| Arabe | Noto Sans Arabic | idem, sans préchargement (téléchargée seulement quand des caractères arabes s'affichent) |

- Plus de police à empattements (Bitter et Noto Serif ont été retirées).
- Lettres kabyles : Inter couvre ɛ ɣ ḍ ṛ ẓ ǧ č ; Plus Jakarta Sans n'a pas ɛ ni ɣ, qui viennent alors d'Inter (vérifié sur les fichiers de police). Manrope, l'autre police envisagée, n'en couvre aucune.
- Titres : graisse 700–800, approche -0,02 em (aucune approche en arabe, pour ne pas casser les liaisons).
- Décalage de mise en page mesuré au premier chargement, réseau ralenti (1,6 Mbit/s, 150 ms) : CLS 0 sur l'accueil et la recherche, 0,007–0,02 sur la page recruteurs (seuil « bon » : 0,1).

## Couleurs (`src/app/globals.css`)

| Jeton | Clair | Sombre | Rôle |
| --- | --- | --- | --- |
| `--primary` | `#2446d6` bleu roi | `#8ca6ff` | actions, liens, focus |
| `--brand-deep` | `#0b1640` bleu nuit | identique | bandeaux, pied de page, panneaux de marque |
| `--foreground` / `--background` | `#0d1430` / `#f6f8fc` | `#eef2ff` / `#070b1a` | encre et fond, neutres froids |
| `--highlight` | `#f6c445` jaune | identique | touches : offre de lancement, soulignés, chiffres d'étapes |
| `--teal` | `#0e7c74` turquoise | `#2dd4bf` | vérification, décor |
| `--input`, `--ring` | bordures de champs ≥ 3:1, anneau de focus bleu roi | | |

Contrastes WCAG 2.2 AA vérifiés pour chaque paire texte / fond utilisée (texte ≥ 4,5:1, composants ≥ 3:1). Sur les surfaces bleu nuit, l'anneau de focus devient jaune (`[--ring:var(--highlight)]`). Le rouge Tamurt reste réservé au logo et au bouton yaz.

## Formes et profondeur

- Rayons : 8–10 px (contrôles, boutons, champs), 14–20 px (cartes), 24 px (grands panneaux).
- Ombres teintées de bleu (`--shadow-xs` à `--shadow-xl`), plus marquées au survol des cartes cliquables (légère élévation, désactivée si l'utilisateur réduit les animations).
- Pastilles arrondies pour les badges, la navigation principale et les filtres de pays.

## Composants revus

En-tête (navigation en pastilles, état actif), logo (« Jobs » redessiné en Plus Jakarta Sans ExtraBold, « TAMURT » et sa ligne tifinagh inchangés), héros (bleu nuit, trame fine, soulignement jaune, pays sur une ligne défilante sur mobile pour remonter la recherche), barre de recherche, cartes d'offres (logo ou initiales, entreprise vérifiée, méta, compétences), badges, sections « Nos engagements » et « Comment ça marche », section recruteurs, tarifs, boutons, champs et listes, pages de compte (panneau de marque + formulaire), page d'offre, entreprises, espaces candidat et recruteur (navigation latérale en carte, chiffres clés), back-office (même cadre), dialogues et menus, pied de page bleu nuit, e-mails (mêmes couleurs).

## Captures avant / après

`tests/visual/screens.spec.ts` (configuration `playwright.visual.config.ts`) capture les pages publiques et les espaces en bureau et mobile, clair et sombre :

```bash
VISUAL_LABEL=apres E2E_BASE_URL=http://localhost:3000 npx playwright test -c playwright.visual.config.ts
```

Les images vont dans `visual-captures/<label>/` (non versionnées, hors de `test-results/` que Playwright vide à chaque lancement).
