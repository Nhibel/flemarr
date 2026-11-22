<p align="center">
  <img src="apps/web/src/assets/logo.svg" alt="Flemarr" width="480">
</p>

<p align="center">
  <strong>Un gestionnaire auto-hébergé pour ta collection de ROMs de jeux rétro.</strong><br>
  Choisis une console, vois tous les jeux sortis dessus, coche ceux que tu veux, télécharge-les un par un.
</p>

<p align="center">
  🇬🇧 <a href="./README.md">Read in English</a>
</p>

---

Télécharger un pack complet pour récupérer un seul jeu, ou passer par des sites bourrés de pubs pour un ROM Game Boy, ça lasse vite. Flemarr donne la liste propre des jeux de chaque console, dit lesquels tu as déjà, et télécharge ceux qui manquent, un par un.

## Ce que fait l'app

- **Des listes de jeux propres.** La liste de chaque console vient des références No-Intro (cartouches) et Redump (disques), filtrée pour ne garder **qu'une version par jeu** (1G1R) : pas de doublons, pas de bêtas, pas dix variantes régionales. Les listes sont récupérées depuis [Fresh1G1R](https://github.com/UnluckyForSome/Fresh1G1R), mis à jour chaque jour ; tu peux aussi importer ton propre fichier `.dat`.
- **Les jaquettes** de chaque jeu, depuis libretro-thumbnails.
- **Savoir ce que tu possèdes.** Scanne le dossier d'une console : les fichiers sont reconnus par leur contenu (CRC32), pas par leur nom. L'app retrouve donc les jeux même mal nommés, et propose de les renommer avec leur nom officiel.
- **Télécharger jeu par jeu** depuis archive.org, soit directement dans le dossier de la console sur le serveur, soit par ton navigateur vers ton ordinateur. Chaque fichier est vérifié par rapport à la référence avant d'être gardé.
- **Les jeux sur disque en un seul fichier.** Les jeux PlayStation, Saturn et autres jeux sur disque peuvent être convertis automatiquement de `.bin`/`.cue` en un seul `.chd`, vérifié piste par piste avant que les originaux soient supprimés. Optionnel.
- **Les téléchargements continuent** en arrière-plan, survivent à un rechargement de la page et laissent un historique sur 30 jours.
- Plusieurs thèmes, une taille de texte réglable, et un affichage qui marche sur Steam Deck comme sur téléphone.

## Comment ça marche

Flemarr est une application web qui tourne dans Docker sur ta propre machine (un NAS, un serveur maison ou un PC), et que tu ouvres dans ton navigateur.

Au premier lancement, elle pose une seule question : **où doivent arriver les jeux téléchargés ?**

- **Dans un dossier du serveur** : les jeux sont rangés et nommés pour toi, et l'app peut scanner le dossier pour voir ce que tu as déjà.
- **Dans les téléchargements de ton navigateur** : tu ranges les jeux toi-même ; l'app affiche la liste complète sans savoir ce que tu possèdes.

Ensuite, ajoute une console, choisis son dossier, et parcours la liste.

Tu débutes ? Le [guide d'utilisation](./docs/guide-utilisateur.md) explique les ROMs, les fichiers DAT et le 1G1R depuis zéro, sans connaissances techniques.

## Prérequis

- **Docker** avec Docker Compose.
- **Un compte archive.org** (gratuit). La plupart des collections de ROMs sur archive.org sont en accès restreint : tu te connectes une fois depuis les réglages de l'app. Ton mot de passe est échangé contre des clés d'accès et n'est jamais enregistré.

## Installation rapide

```sh
git clone https://github.com/Nhibel/flemarr.git
cd flemarr
cp .env.example .env        # puis mets dans ROMS_HOST_DIR le dossier de ta collection
docker compose up -d --build
```

Ouvre `http://127.0.0.1:3000`.

Il n'y a pas d'image toute prête : la stack se construit depuis le Dockerfile, ce qui prend quelques minutes la première fois.

### Monter ta collection

Fais pointer `ROMS_HOST_DIR` **directement sur le dossier de ta collection**, pas sur son dossier parent. Il est monté sur `/roms` dans le conteneur, et tout ce que l'app fait sur le disque reste à l'intérieur : rien en dehors de la collection ne peut être lu ni écrit. Dans l'app, tu choisis (ou crées) ensuite une fois le dossier de chaque console, dans la barre en haut de l'écran de la console.

```sh
# .env
ROMS_HOST_DIR=/srv/roms
```

### Configuration

| Variable           | Défaut      | Rôle                                                                              |
| ------------------ | ----------- | --------------------------------------------------------------------------------- |
| `BIND_ADDR`        | `127.0.0.1` | Adresse de l'hôte où le port est publié. Boucle locale par défaut, voir Sécurité. |
| `PORT`             | `3000`      | Port de l'hôte où l'app est publiée.                                              |
| `ROMS_HOST_DIR`    | `./roms`    | Dossier de l'hôte qui contient ta collection ; monté sur `/roms`.                 |
| `ROMS_ROOT`        | `/roms`     | Racine de la collection dans le conteneur, à laquelle tout est limité.            |
| `FLEMARR_DATA_DIR` | `/data`     | Emplacement de la base SQLite et du cache des DAT (le volume `flemarr-data`).     |

Tout le reste (le préréglage 1G1R, le nombre de téléchargements simultanés, le dossier de chaque console, le compte archive.org, la destination des téléchargements, la conversion en `.chd`) se règle depuis la page **Réglages** de l'app et est enregistré dans sa base.

### Déployer sur un serveur maison

- **Portainer** : Stacks → Add stack → _Repository_, indique ce dépôt et `docker-compose.yml`. Portainer le clone et le construit.
- **SSH** : `git clone`, puis `docker compose up -d --build`.

Pour mettre à jour, récupère le dernier commit et reconstruis (dans Portainer : _Pull and redeploy_).

## ⚠️ Sécurité

Flemarr n'a **aucune authentification**. Elle est faite pour tourner en local ou sur un réseau domestique de confiance, c'est pourquoi le fichier compose publie le port sur `127.0.0.1`. Ne mets `BIND_ADDR=0.0.0.0` que sur un réseau local de confiance, et ne l'expose **jamais** sur Internet sans un reverse proxy authentifié ou un VPN devant, en HTTPS : quiconque y accède peut utiliser ton compte archive.org et écrire dans ta collection. Détails et options (en anglais) : [docs/security.md](./docs/security.md).

## Mentions légales

Flemarr est un gestionnaire de collection : il n'héberge aucun jeu et ne fournit aucun ROM. Le droit d'auteur sur les ROMs varie selon les pays ; ne télécharge que les jeux auxquels tu as droit.

## Développement

Voir la [version anglaise](./README.md#development).

Idées, bugs, retours : ouvre une issue.

## Licence

[MIT](./LICENSE)
