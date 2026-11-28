# Guide d'utilisation — Flemarr

Ce document explique ce que fait l'application, comment elle fonctionne, et ce qu'elle propose — sans supposer de connaissances techniques. Si un mot vous est inconnu, il est expliqué la première fois qu'il apparaît.

---

## En une phrase

**Flemarr** aide à organiser une collection personnelle de jeux vidéo rétro (des « ROMs », voir plus bas) : savoir ce qu'on a déjà, ce qui manque, et télécharger ce qui manque — proprement, sans doublons, avec des noms de fichiers cohérents.

---

## D'abord, le vocabulaire

### Un ROM

Un **ROM** est la copie numérique du contenu d'une cartouche ou d'un disque de jeu vidéo ancien (Super Nintendo, PlayStation, Mega Drive, etc.). C'est un fichier qu'un émulateur (un programme qui imite une console) peut lire pour faire tourner le jeu sur un ordinateur, une console portable, ou un boîtier comme un Steam Deck ou une RetroPie.

### Un DAT

Un **DAT** est une liste de référence : pour une console donnée, il recense _tous_ les jeux officiellement sortis, avec leur nom exact, leur taille, et une empreinte numérique (le **CRC32** — une sorte de code-barres du fichier, qui permet de vérifier qu'un fichier est bien celui qu'on croit, sans se tromper). Deux organisations tiennent ces listes :

- **No-Intro** pour les jeux sur cartouche (NES, SNES, N64, Game Boy, Mega Drive…).
- **Redump** pour les jeux sur disque (PlayStation, PS2, GameCube, Dreamcast, Saturn…).

L'application charge ces DAT pour savoir à quoi un jeu « correct » doit ressembler, et pour reconnaître les fichiers qu'on possède déjà.

### Le 1G1R (« One Game, One ROM »)

Un même jeu sort souvent en plusieurs versions : USA, Europe, Japon, parfois une version corrigée (« révision »), parfois des versions sans licence officielle ou de simples démos. Le **1G1R** est un tri qui ne garde qu'**une seule version par jeu** — en général la version anglaise/USA ou Europe la plus récente — pour éviter de télécharger ou stocker dix fois le même jeu sous dix formes différentes. C'est ce tri que l'application charge par défaut (préréglage « PropeR », un des filtres proposés par le projet [Fresh1G1R](https://github.com/UnluckyForSome/Fresh1G1R) qui fournit ces listes déjà triées, mises à jour tous les jours).

### Un scan

**Scanner** un dossier, c'est demander à l'application de regarder les fichiers qu'il contient, de calculer leur empreinte (CRC32), et de les comparer à la liste du DAT — pour savoir lesquels sont de vrais ROMs reconnus, et lesquels manquent encore.

### CHD

Le **.chd** est un format de fichier qui compresse un jeu disque (plusieurs fichiers `.bin`/`.cue`) en un seul fichier, sans perte — rien n'est dégradé, juste rangé plus efficacement. C'est le format que préfèrent la plupart des frontaux d'émulation modernes (EmuDeck, par exemple) : une bibliothèque en `.chd` est plus compacte et plus simple à gérer qu'une bibliothèque en fichiers `.bin`/`.cue` séparés.

---

## Ce que l'application permet de faire

1. **Charger la liste des jeux d'une console** (le DAT), soit en important un fichier soit directement depuis Fresh1G1R en deux clics — pas besoin de le télécharger à la main.
2. **Parcourir et filtrer** cette liste : rechercher par nom, filtrer par région, voir une miniature de la jaquette pour chaque jeu.
3. **Choisir les jeux qu'on veut** dans sa collection, un par un ou par lot.
4. **Scanner un dossier existant** pour voir ce qu'on possède déjà, et renommer en un clic les fichiers reconnus selon le nom officiel du DAT — plus de fichiers avec des noms bizarres ou incohérents entre eux.
5. **Télécharger les jeux manquants** depuis archive.org, un par un (pas de pack de collection entière à décompresser) — au choix, soit directement rangés dans le dossier du serveur, soit envoyés vers son propre navigateur pour les récupérer où l'on veut.
6. **Vérifier automatiquement** chaque téléchargement : l'empreinte CRC32 du fichier téléchargé est comparée à celle attendue par le DAT. Un fichier corrompu ou incorrect n'est jamais gardé.
7. **Convertir automatiquement les jeux disque en `.chd`** après téléchargement (optionnel, à activer dans les réglages) — avec une vérification bit à bit avant de supprimer les fichiers d'origine, pour ne jamais perdre un téléchargement à cause d'une conversion ratée.

---

## Comment ça marche, étape par étape

### 1. Dire où arrivent les jeux téléchargés

À la toute première utilisation, l'application pose une seule question : **où arrivent les jeux téléchargés ?** Deux réponses :

- **Dans un dossier du serveur** (le plus complet) : l'application range et renomme les jeux dans un dossier par console, et peut scanner ce dossier pour reconnaître ce que vous avez déjà. Ce dossier peut être un disque de la machine, un volume Docker ou un partage réseau monté sur le serveur.
- **Dans les téléchargements de mon navigateur** : vous rangez les jeux vous-même. Le serveur ne voit pas votre collection, donc il affiche le catalogue complet en disant franchement qu'il ne sait pas ce que vous avez, au lieu d'afficher un compteur faux — et l'onglet Scanner n'apparaît pas.

C'est la première question parce que sa réponse décide de deux choses d'un coup : où arrivent les fichiers téléchargés, et si l'application peut reconnaître ce qu'on possède déjà.

Ce choix ne touche jamais aux fichiers, et il se change plus tard dans les réglages.

### 2. Choisir une console et charger sa liste de jeux

L'écran d'accueil montre vos consoles sous forme de cartes ; le bouton **+ Ajouter un système**, au-dessus de la liste, en ajoute une. On choisit une console. L'appli propose de récupérer automatiquement la liste officielle et triée (1G1R) des jeux pour cette console — ou on peut importer son propre fichier DAT si on préfère.

### 3. Parcourir et sélectionner

La liste des jeux s'affiche, avec jaquette, nom, région et taille. On peut chercher, filtrer, et cocher les jeux qu'on veut avoir dans sa collection.

### 4. Scanner ce qu'on a déjà (optionnel, mais recommandé)

Si on a déjà des ROMs sur son disque (dans un dossier existant, même mal rangé ou mal nommé), l'appli peut scanner ce dossier : elle calcule l'empreinte de chaque fichier et la compare au DAT. Les fichiers reconnus sont marqués comme possédés ; ceux qui sont mal nommés sont listés avec leur nom officiel, on coche ceux à corriger et un bouton les renomme d'un coup. Si un autre fichier porte déjà le bon nom (doublon), il est laissé tel quel et signalé. Les fichiers absents du DAT restent inchangés : ce sont souvent d'autres versions (Europe, France…) d'un jeu de la liste. Le bouton **Rattacher** indique de quel jeu il s'agit : il compte alors comme possédé (« Autre version »), sans renommer le fichier, et **Détacher** annule. **Tout rattacher…** propose un jeu pour chaque fichier d'un coup : seuls ceux dont le titre est exactement celui d'un seul jeu, pas encore possédé, sont cochés d'office ; les autres sont à vérifier, car seul le titre est comparé, pas le contenu. Un jeu déjà converti en `.chd` est reconnu par son nom de fichier ; s'il a été renommé, l'application le décompresse pour l'identifier, ce qui prend quelques secondes. Le résultat du dernier scan est gardé : pas besoin de rescanner à chaque visite.

Après un scan, chaque ligne de la liste porte son état : **sur ton disque**, **mal nommé** (le fichier est là, seul son nom est à corriger) ou **manquant**. Tant qu'aucun scan n'a tourné, aucune ligne n'affiche d'état — l'application préfère ne rien dire que de prétendre savoir.

### 5. Télécharger ce qui manque

Pour chaque jeu sélectionné qu'on ne possède pas encore, l'appli va chercher une source sur archive.org (un site d'archivage public) et propose de le télécharger. Où le fichier atterrit découle de la réponse donnée à l'installation (« où arrivent les jeux téléchargés ? »), pas d'un choix à refaire à chaque téléchargement :

- **Dans un dossier du serveur** : le fichier est rangé directement dans le dossier de la console, renommé au nom officiel, prêt à l'emploi.
- **Dans les téléchargements du navigateur** : le fichier est validé par le serveur puis envoyé comme un téléchargement classique de navigateur, à ranger où l'on veut soi-même.

Dans les deux cas la vérification d'intégrité (CRC32) se fait côté serveur **avant** que le fichier soit remis, donc un téléchargement corrompu n'arrive jamais jusqu'au bout.

Pendant le téléchargement, une barre de progression s'affiche pour chaque fichier. On peut annuler un téléchargement en cours, ou toute la file d'attente. Les téléchargements continuent sur le serveur même si on recharge la page ou qu'on la ferme : en revenant, on retrouve leur progression.

### 6. (Optionnel) Conversion automatique en `.chd`

Si l'option est activée dans les réglages, chaque jeu disque téléchargé (ceux qui ont plusieurs fichiers `.bin`/`.cue`) est automatiquement regroupé en un seul fichier `.chd` une fois le téléchargement terminé — l'appli vérifie que la conversion est parfaite avant de supprimer les fichiers d'origine. Si la vérification échoue pour une raison quelconque, les fichiers d'origine restent intacts et rien n'est perdu.

### 7. Après coup

Une fois les téléchargements terminés, un bouton permet de vider la liste des téléchargements terminés de l'écran — sans toucher à ceux encore en cours. Sous la liste, un historique garde les téléchargements des 30 derniers jours.

Quand Fresh1G1R publie une nouvelle version de la liste d'une console, sa carte sur l'écran d'accueil le signale et propose de la charger.

---

## Les collections à accès restreint

Certaines collections sur archive.org demandent un compte pour y accéder. L'application permet de se connecter avec son propre compte archive.org une fois dans les réglages ; le mot de passe n'est jamais conservé, seules les clés d'accès temporaires le sont.

---

## Ce que l'application ne fait pas

- **Elle n'émule rien.** C'est un outil de rangement de fichiers, pas un émulateur — il faut un programme séparé (RetroArch, EmuDeck, etc.) pour jouer.
- **Elle n'est pas multi-utilisateur.** C'est un outil personnel, pensé pour un usage privé (« homelab »).
- **Elle ne protège pas l'accès par un mot de passe.** Elle est prévue pour rester sur un réseau local ou personnel, pas exposée directement sur internet sans protection supplémentaire.
- **Elle ne récupère pas de descriptions ou d'informations détaillées sur les jeux** (année, genre, résumé) — seules les jaquettes sont affichées.

---

## Où régler tout ça

La page **Réglages** (icône en forme d'engrenage) permet de configurer : l'apparence (neuf thèmes de couleurs, et la taille du texte), où arrivent les jeux téléchargés — la même question qu'à l'installation, c'est là qu'on change d'avis —, le préréglage 1G1R à utiliser, le dossier de chaque console, le nombre de téléchargements simultanés, la conversion automatique en `.chd`, et les identifiants archive.org si besoin.

Il n'y a **pas** de réglage séparé « serveur ou navigateur » : c'est la conséquence de la question sur l'emplacement des jeux, pas une décision à part.
