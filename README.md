# Advanced To-Do List — Conteneurisation avec Docker

Application full stack (To-Do List / Kanban) conteneurisée avec **Docker** et orchestrée avec **Docker Compose**. Chaque composant (frontend, backend, base de données) tourne dans son propre conteneur.

- **Dépôt Git :** https://github.com/linaoueslati03/projet-docker
- **Images Docker Hub :** https://hub.docker.com/u/linaesther

---

# Stack technique

| Composant | Technologie | Image |
|---|---|---|
| **Frontend** | HTML / CSS / JS servis par **Nginx** | `linaesther/projet-docker-frontend` |
| **Backend** | API REST **Node.js / Express** | `linaesther/projet-docker-backend` |
| **Base de données** | **PostgreSQL** | `postgres:16-alpine` (image officielle) |

---

## Architecture Docker

```
                      🌐 NAVIGATEUR
                           │
                           │  http://localhost:3000
                           ▼
   ┌───────────────────────────────────────────────────────────┐
   │                  RÉSEAU Docker : reseauproj (bridge)        │
   │                                                             │
   │  ┌──────────────┐     ┌──────────────┐     ┌─────────────┐  │
   │  │  FRONTEND    │/api │   BACKEND     │     │  DATABASE   │  │
   │  │ kanban-      │────▶│  kanban-      │────▶│ kanban-db   │  │
   │  │ frontend     │     │  backend      │     │ (PostgreSQL)│  │
   │  │ (Nginx :80)  │     │ (Node :3000)  │     │   :5432     │  │
   │  └──────────────┘     └──────────────┘     └──────┬──────┘  │
   │   port 3000 exposé      (non exposé)        (non exposé)   │ │
   └───────────────────────────────────────────────────┼────────┘
                                                        │
                                            ┌───────────▼──────────┐
                                            │  VOLUME postgresdata  │
                                            │  (persistance des     │
                                            │   données PostgreSQL) │
                                            └──────────────────────┘
```

# Services
- **kanban-frontend** — Nginx sert l'interface et fait office de *reverse proxy* : il redirige les requêtes `/api` vers le backend. Seul service exposé à l'extérieur (port **3000**).
- **kanban-backend** — API REST Node/Express. Reçoit les requêtes du frontend et lit/écrit dans la base. Non exposé à l'hôte (accessible uniquement via le réseau Docker).
- **kanban-db** — PostgreSQL. Initialisée au premier démarrage par `database/init.sql`. Non exposée à l'hôte.

# Réseau
- **reseauproj** (driver `bridge`) — réseau personnalisé reliant les 3 conteneurs. Comme seuls les ports nécessaires sont publiés (uniquement le frontend en 3000), le **backend et la base ne sont pas accessibles depuis l'extérieur** : la communication backend ↔ base de données reste **interne et sécurisée**.

# Volume
- **postgresdata** — monté sur `/var/lib/postgresql/data` dans le conteneur de la base. Il **conserve les données** même si le conteneur est supprimé et recréé.

---

# Prérequis

- [Docker](https://www.docker.com/products/docker-desktop/) et **Docker Compose** installés
- Docker Desktop **lancé** 

---

# Construire et démarrer l'application

```bash
# 1. Cloner le dépôt
git clone https://github.com/linaoueslati03/projet-docker.git
cd projet-docker

# 2. Lancer toute l'application (télécharge les images et démarre les 3 conteneurs)
docker compose up -d

# 3. Vérifier que les 3 conteneurs tournent
docker compose ps
```

Puis ouvrir dans le navigateur : **http://localhost:3000**

# Arrêter l'application
```bash
docker compose down        # arrête et supprime les conteneurs (garde les données)
docker compose down -v     # + supprime le volume (efface les données)
```

> Les variables d'environnement (utilisateur, mot de passe, nom de la base) sont définies dans le fichier **`.env`** à la racine et partagées entre le backend et la base de données.

---

# Variables d'environnement (`.env`)

```env
POSTGRES_USER=kanban
POSTGRES_PASSWORD=kanban_secret
POSTGRES_DB=kanban

DB_HOST=database     # nom du service de la base sur le réseau Docker
DB_PORT=5432
DB_USER=kanban
DB_PASSWORD=kanban_secret
DB_NAME=kanban
PORT=3000
```
Les valeurs `POSTGRES_*` (création de la base) doivent correspondre aux valeurs `DB_*` (connexion du backend).

---

# 🔌 API (backend)

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/health` | État du service + mode de stockage |
| `GET` | `/api/tasks` | Liste des tâches |
| `POST` | `/api/tasks` | Créer une tâche `{ title, emoji?, status?, due_date? }` |
| `PATCH` | `/api/tasks/:id` | Modifier une tâche |
| `DELETE` | `/api/tasks/:id` | Supprimer une tâche |

---

# Guide de test

### 1. Tester la communication entre les conteneurs
La communication frontend → backend → base se vérifie en ajoutant une tâche puis en la retrouvant directement dans la base.


# La retrouver directement dans PostgreSQL
docker exec kanban-db psql -U kanban -d kanban -c "SELECT id, title, status FROM tasks ORDER BY id;"
```
👉 Si la tâche apparaît dans la base, c'est que les 3 conteneurs communiquent bien.

### 2. Tester la persistance des données
```bash
# 1. Compter les tâches
docker exec kanban-db psql -U kanban -d kanban -c "SELECT COUNT(*) FROM tasks;"

# 2. Tout arrêter (SANS -v → le volume est conservé)
docker compose down

# 3. Vérifier que le volume existe toujours
docker volume ls | grep postgres        # → projet-docker_postgresdata

# 4. Relancer
docker compose up -d

# 5. Recompter → le nombre de tâches est identique
docker exec kanban-db psql -U kanban -d kanban -c "SELECT COUNT(*) FROM tasks;"
```
Les données sont identiques après redémarrage : le volume `postgresdata` assure la **persistance**.

---

# Structure du projet

```
projet-docker/
├── docker-compose.yml        # orchestration des 3 services
├── .env                      # variables d'environnement
├── frontend/
│   ├── Dockerfile            # image Nginx
│   ├── nginx.conf            # config + reverse proxy /api
│   ├── index.html / style.css / app.js
├── backend/
│   ├── Dockerfile            # image Node/Express
│   ├── .dockerignore
│   ├── server.js / db.js
│   └── package.json
└── database/
    └── init.sql              # schéma + données de démo
```

---

# Auteurs

Projet réalisé en groupe de 3 :
- *Lina* — Backend & Docker Hub
- *Celia* — Frontend & Nginx
- *Amandine* — Base de données & orchestration
