# UniPlatform

Plateforme universitaire en ligne : cours en visioconférence, annonces,
devoirs, chat et partage de fichiers.

- **Frontend** : React (dossier `front/`)
- **Backend** : Node.js + Express + Socket.io (dossier `server/`)
- **Base de données** : MySQL
- **Visioconférence** : architecture SFU via [LiveKit Cloud](https://cloud.livekit.io)
- **Emails** : SMTP Gmail

## Prérequis

- Node.js >= 18
- MySQL (ex. via WAMP / XAMPP / MySQL Server)
- Un projet [LiveKit Cloud](https://cloud.livekit.io) (gratuit) pour la vidéo
- Un compte Gmail avec un *mot de passe d'application* pour l'envoi d'emails

## Installation

1. **Configurer les variables d'environnement**

   Copiez le modèle puis renseignez vos valeurs :

   ```bash
   cp server/.env.example server/.env
   ```

   Éditez `server/.env` (voir les commentaires du fichier pour chaque variable :
   base de données, JWT, LiveKit, email, etc.).

2. **Installer les dépendances**

   ```bash
   cd server && npm install
   cd ../front && npm install
   ```

## Lancement (en local)

Assurez-vous que **MySQL est démarré**, puis dans deux terminaux :

```bash
# Terminal 1 — serveur (API + Socket.io), port 3003
cd server && npm start

# Terminal 2 — frontend React, port 3000
cd front && npm start
```

Ouvrez ensuite **http://localhost:3000**.

La base de données et ses tables sont créées automatiquement au premier démarrage
du serveur.

## Structure

```
front/    Application React
server/   API Express, Socket.io, accès MySQL, emails, jetons LiveKit
```
