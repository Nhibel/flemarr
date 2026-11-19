# Brief UX/UI — rom-curator

> **Document historique — rédigé le 2026-11-14, avant le redesign.**
>
> C'est le brief qui a servi d'entrée au travail de design, pas une
> description de l'app actuelle. Tout ce qu'il décrit comme existant a
> changé depuis : les sept thèmes ont remplacé les neuf, la section
> « Destination des téléchargements » des Réglages n'existe plus (remplacée
> par la question « où vivent tes jeux »), les lignes de la bibliothèque
> portent leur état de possession, et il n'y a plus de bordures nulle part.
>
> **Pour l'état réel de l'interface, lire la Phase 14 de
> [ROADMAP.md](../ROADMAP.md)**, qui liste aussi les écarts assumés aux
> maquettes et les raisons. Les sections « friction ressentie » et
> « objectif » ci-dessous restent valables comme intention produit ; la
> section 5 (inventaire des écrans) et les listes de composants sont
> périmées.
>
> Les deux canvas que ce brief a produits sont des Artifacts privés dont
> les fichiers de travail vivent dans `.rom-curator-data/design-scratch/`
> et `.rom-curator-data/design-directions/` — **gitignorés**, donc locaux à
> la machine de Camille. Seules les URLs Artifact sont durables.

Destiné à Claude Design. Ce document ne décrit pas l'implémentation (le code source est disponible séparément) — il couvre ce que le code ne dit pas : intention produit, parcours réels, friction ressentie, et attentes pour la direction visuelle.

---

## 1. Objectif de l'app et utilisateurs cibles

**Ce que l'app fait** : rom-curator aide à constituer une collection personnelle de jeux rétro propre et complète. Elle part d'une liste officielle de jeux pour une console (un fichier DAT), compare cette liste à ce que l'utilisateur possède déjà sur disque, et télécharge individuellement ce qui manque depuis archive.org — jamais une collection complète à décompresser. Un detail technique notable pour la hiérarchie d'info : la vérification d'intégrité (CRC32) après chaque téléchargement est au cœur de la confiance dans l'outil — ce n'est pas un détail secondaire, l'app ne garde jamais un fichier dont elle n'a pas pu confirmer qu'il correspond exactement à l'entrée officielle.

**Utilisateurs cibles** (deux profils réels, à concilier) :

1. **L'auteure elle-même** — usage homelab quotidien, à l'aise avec les notions techniques (archive.org, CRC32, formats de ROM, Docker). Utilise l'app sur desktop et sur Steam Deck.
2. **Des amis non-techniques** — intéressés pour faire tourner leur propre instance chez eux (partage envisagé, par exemple via un message à des contacts). Ce profil n'a pas le vocabulaire du domaine (DAT, 1G1R, CRC32, zip-view, archive-container…) et n'a jamais utilisé d'outil de curation de ROM. **Ce second profil doit influencer le design** : l'onboarding (premier DAT chargé, première configuration de dossier, premier téléchargement) doit rester compréhensible sans connaissance préalable, même si l'app garde par ailleurs des réglages avancés pertinents seulement pour le premier profil.

L'app est mono-utilisateur par instance (pas de comptes, pas de permissions) et n'a aucune authentification — elle est conçue pour tourner sur un réseau local ou personnel, jamais exposée directement sur internet.

---

## 2. Écrans et graphe de navigation

L'app n'a pas de routeur — c'est une machine à états à 4 vues. Les vues `game` (celle où on passe le plus de temps) a elle-même 4 onglets internes, toujours montés (état préservé en changeant d'onglet).

```
┌─────────────┐  charge/reprend un DAT   ┌──────────────┐
│   Loader     │ ───────────────────────▶ │     Game      │
│ (accueil)   │ ◀─────────────────────── │  (4 onglets)  │
└──────┬──────┘   "Charger un autre DAT"  └──────┬───────┘
       │                                          │
       │              ┌───────────────────────────┤
       ▼              ▼                           ▼
  [Lexique]      [Réglages]                  onglets internes :
  (glossaire,    (page longue,                 Jeux → Scanner → Sources → Téléchargements
   lecture        7 sections                   (ordre de gauche à droite dans la barre,
   seule)         empilées)                     pas un flux imposé — on va et vient)
```

- **Loader (accueil)** — écran de démarrage. Deux modes bascule-boutons : "Fresh1G1R" (parcourir et charger un preset de DAT déjà filtré, par système) ou "Manuel" (glisser-déposer un fichier `.dat`). Une liste "Reprendre un DAT chargé" permet de resélectionner un système déjà configuré sans re-parser.
- **Game (vue principale)** — une fois un DAT actif. En-tête : nom du système, source (No-Intro/Redump), nombre de jeux, bouton retour à l'accueil. Juste sous l'en-tête, une barre persistante affiche/édite le dossier de bibliothèque du système (absente en mode "téléchargement vers le navigateur").
  - **Onglet Jeux** — parcourir/filtrer/sélectionner les jeux de la liste. Écran où l'utilisateur passe le plus de temps.
  - **Onglet Scanner** — scanner le dossier du système pour détecter ce qui est déjà possédé et proposer des renommages. Masqué entièrement en mode "téléchargement vers le navigateur" (rien à scanner côté serveur dans ce mode).
  - **Onglet Sources** — combine deux choses actuellement empilées sur un même écran : (a) la gestion des sources archive.org pour ce système (ajouter/retirer/suggérer des identifiants de collection), et (b) la résolution des sources pour les jeux sélectionnés puis le lancement du téléchargement. Voir section 4 — c'est un des points de friction identifiés.
  - **Onglet Téléchargements** — suivi en temps réel des téléchargements en cours, conversion CHD en arrière-plan, bouton pour vider les téléchargements terminés.
- **Réglages** — écran plein (pas un onglet), accessible depuis une icône engrenage. Une seule longue page, 7 sections empilées sans ancres ni sous-navigation : Apparence (thème), Préréglage 1G1R, Compte archive.org, Concurrence de téléchargement, Destination des téléchargements, Conversion CHD, Dossiers par système.
- **Lexique** — glossaire en lecture seule, organisé en 4 sections thématiques (Sets et presets, Régions et catégories, Formats de ROM, Archive.org et téléchargement). Accessible depuis la même icône (livre) que Réglages (engrenage), sur Loader et sur Game.

Un petit widget persistant (+/− pour la taille du texte) est ancré en haut à droite de l'écran, visible sur toutes les vues, indépendant de la navigation.

---

## 3. Parcours principaux

### A. Premier lancement → premier téléchargement (le parcours qui doit convaincre un ami non-technique)

1. Accueil → choisir un système dans le navigateur Fresh1G1R → charger le preset.
2. Bascule automatique vers la vue Game, onglet Jeux : parcourir, filtrer, cocher des jeux.
3. Aller dans l'onglet Sources → section gestion des sources : cliquer "✨ Suggérer des sources" → adopter une suggestion archive.org.
4. Toujours dans Sources, section résolution : cliquer "Chercher les sources" pour les jeux cochés.
5. Cliquer "Télécharger" → bascule automatique vers l'onglet Téléchargements, suivi en temps réel.
6. (Optionnel) Si le dossier du système n'a jamais été choisi, une étape de configuration de dossier s'intercale avant qu'un téléchargement serveur puisse réussir.

_(C'est le parcours le plus long et le plus jargonneux — voir section 4 pour le détail des frictions.)_

### B. Scanner une collection existante avant de combler les manques

1. Vue Game, barre "Dossier du système" → choisir un dossier déjà rempli de ROMs.
2. Onglet Scanner → lancer le scan → voir ce qui est reconnu, mal nommé, ou introuvable.
3. (Optionnel) Sélectionner des suggestions de renommage → renommer en lot.
4. Retour à l'onglet Jeux, sélectionner les jeux qu'on veut avoir → la case "Exclure les jeux déjà possédés" dans l'onglet Sources utilise ce résultat de scan pour ne proposer que ce qui manque réellement.

### C. Télécharger directement sans scanner (collection neuve, ou mode navigateur)

1. Onglet Jeux : sélectionner les jeux voulus.
2. Onglet Sources → résoudre → télécharger (vers le serveur ou vers le navigateur selon le réglage global).
3. Onglet Téléchargements pour suivre.

### D. Gérer les sources archive.org pour un système (tâche ponctuelle, pas répétée à chaque session)

1. Onglet Sources → "✨ Suggérer des sources" ou "+ Ajouter" manuellement (identifiant archive.org, détection de la disposition des fichiers).
2. Retirer une source qui ne fonctionne plus.

Ce parcours partage le même écran que le parcours de téléchargement (A/C) alors qu'il est fait rarement, contrairement à A/C faits à chaque session — voir section 4.

### E. Ajuster les réglages globaux (thème, cible de téléchargement, conversion CHD, etc.)

1. Icône engrenage depuis Loader ou Game → une seule longue page, défilement jusqu'à la section voulue.
2. Modification sauvegardée au changement (pas de bouton "Enregistrer" global) sauf pour le dossier par système et la connexion archive.org.
3. Retour manuel (lien texte "← Retour", pas de breadcrumb).

---

## 4. Problèmes UX repérés

- **Étapes superflues/jargon dans le parcours principal (A)** : "Résolution des sources" est un terme technique qu'un ami non-technique ne devinera pas. Le fait qu'il faille comprendre la distinction entre "gérer les sources" (ponctuel) et "résoudre + télécharger" (fréquent) — alors que les deux vivent sur le même onglet, l'un empilé au-dessus de l'autre — n'est pas évident sans lire le code.
- **Un onglet fait deux métiers différents** : "Sources" mélange configuration (ajout/suppression de collections archive.org — tâche rare) et action principale (résoudre + lancer le téléchargement — tâche fréquente). Un nouvel utilisateur doit défiler/comprendre la section de configuration avant d'atteindre l'action qu'il cherche à chaque session.
- **Pas de parcours guidé pour un tout premier DAT** : rien ne distingue "je n'ai jamais rien configuré" de "j'ai déjà tout configuré" — le nouvel utilisateur atterrit sur le même écran que l'utilisateur expérimenté, sans indication de l'ordre des étapes (charger un DAT → configurer un dossier → ajouter une source → sélectionner → télécharger). Les avertissements existent ("Ajoutez au moins une source ci-dessus", "Aucun dossier défini…") mais seulement **après** avoir tenté l'action suivante, pas avant, sous forme d'étapes.
- **Réglages = une seule longue page sans structure** : 7 sections empilées (Apparence, Préréglage 1G1R, Compte archive.org, Concurrence, Destination des téléchargements, Conversion CHD, Dossiers par système) sans ancre ni sous-menu. Sur un petit écran (Steam Deck), c'est beaucoup de défilement pour atteindre un seul réglage.
- **Pas de sélecteur de dossier natif** : le choix de dossier (bandeau "Dossier du système", réglage par système) repose sur un champ texte avec autocomplétion (liste les sous-dossiers, permet d'en créer un) — pas un vrai sélecteur de fichiers du système d'exploitation. Fonctionnel pour un utilisateur technique, probablement déroutant pour quelqu'un qui n'a jamais tapé un chemin de fichier à la main.
- **États vide/erreur minimalistes, texte seul** : la plupart des états vides ("Aucune source configurée", "Aucun téléchargement en cours", liste de jeux vide) sont une simple phrase grise, sans illustration ni call-to-action visuellement mis en avant vers l'action à faire ensuite.
- **Pas de retour arrière cohérent** : Réglages et Lexique utilisent un lien texte "← Retour" ; il n'y a pas de fil d'Ariane (breadcrumb), et revenir ramène soit à l'accueil soit à la vue Game selon qu'un DAT était actif — logique correcte mais jamais explicitée à l'écran.
- **Beaucoup d'allers-retours entre onglets dans le parcours A** : sélectionner (Jeux) → configurer une source (Sources, section haute) → résoudre (Sources, section basse) → suivre (Téléchargements) implique de changer d'onglet au moins 3 fois pour une seule action de bout en bout, sans indicateur visuel de progression à travers ces étapes.
- **Hiérarchie d'info** : dans l'onglet Jeux, le compte de sélection et le bouton "passer à l'onglet suivant" partagent une petite bande fixe sous la liste — peu visible, facile à manquer en premier usage.
- **8 thèmes visuels dont plusieurs très marqués** (Cyberpunk, Matrix, Nintendo, Megadrive, Sonic Mania) à côté de thèmes neutres (Clair, Sombre, Catppuccin) — cohérence de marque peu définie ; voir section 6, ce point est ouvert à redéfinition.

---

## 5. Composants existants à réutiliser

Composants génériques (`apps/web/src/components/`) :

- `Button` — variantes `primary` / `secondary` / `danger` / `ghost`, tailles `sm` / `md`.
- `Card` — conteneur de surface avec bordure/ombre, utilisé pour toute liste/bloc groupé.
- `Chip` — pastille comptage + couleur sémantique (vert/ambre/gris), utilisée pour les résumés de scan et de résolution.
- `PathInput` (désormais dans `features/folders/`, car il appelle l'API) — champ de chemin avec autocomplétion de sous-dossiers et création de dossier inline.
- `SystemFolderBar` (désormais dans `features/folders/`, car il lit et écrit les réglages) — bandeau persistant affichant/éditant le dossier du système actif.
- `FontScaleControl` — widget +/− flottant, taille fixe en pixels (volontairement pas liée à l'échelle de texte qu'il contrôle).
- Icônes : `BookIcon`, `GearIcon` (SVG inline, pas de bibliothèque d'icônes externe).

Composants de fonctionnalité réutilisables comme patterns :

- `GameRow` / `GameList` / `GameFilters` / `SelectionSummary` — la liste de jeux paginée, avec case à cocher, jaquette optionnelle, recherche/filtres/tri.
- `SourceRow` / `SuggestionRow` / `AddSourceForm` / `LayoutBadge` — gestion d'une source archive.org.
- `ResolvedGameRow` / `SearchResultRow` — résultat de résolution par jeu, avec choix de source alternative si plusieurs matches.
- `DownloadManager` (et ses sous-composants internes `JobCard`, `DownloadRow`, `GameConversionRow`) — file de téléchargement avec progression en temps réel, conversion CHD, bouton de nettoyage.
- Les sections de `Réglages` (`AppearanceSection`, `PresetSection`, `ArchiveAccountSection`, `ConcurrencySection`, `DownloadTargetSection`, `AutoConvertChdSection`, `SystemPathsSection`) — chacune autonome, pattern réutilisable pour toute nouvelle structuration de cette page (ex. en onglets ou accordéons).

Système de design : Panda CSS (tokens sémantiques `bg.*`, `fg.*`, `accent.*`, `status.*`, échelle `fontSize`/espacement en `rem`, dérivée d'une seule variable racine ajustable par l'utilisateur). 8 thèmes actifs via un seul attribut `data-theme`.

---

## 6. Mes attentes

- **Public** : moi (usage technique quotidien) **et** des amis non-techniques qui installeraient leur propre instance — le design doit couvrir les deux, avec un onboarding qui ne suppose aucune connaissance du vocabulaire du domaine.
- **Thèmes existants (Clair, Sombre, Catppuccin, Cyberpunk, Matrix, Nintendo, Megadrive, Sonic Mania)** : ouverts à être repensés. Pas une contrainte à préserver tels quels — Claude Design peut proposer de les simplifier, en réduire le nombre, ou les redéfinir dans une direction plus cohérente.
- **Plateformes** : desktop et Steam Deck/mobile à égalité — aucune des deux ne doit être traitée comme secondaire.
- **Ton visuel** : moderne et fonctionnel. Explicitement **pas** le style austère des *arr apps (Sonarr/Radarr) — plus accueillant/soigné que ça, sans référence précise imposée par ailleurs. Liberté complète sur la proposition.
- **Contrainte technique à garder en tête** (pas un choix produit, un fait du code) : toute donnée affichée transite par le backend — aucune requête directe du navigateur vers archive.org ou GitHub. Ça ne contraint pas le visuel, mais explique pourquoi certaines actions (résolution, suggestion de sources) ont un temps de latence réseau visible à concevoir (état de chargement), pas instantané.

---

## 7. Ce que je demande à Claude Design

Proposer une direction visuelle et repenser l'enchaînement des écrans des parcours prioritaires (en particulier le parcours A — premier DAT jusqu'au premier téléchargement — et la séparation entre gestion des sources et résolution/téléchargement dans l'onglet Sources).
