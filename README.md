# KayyDrive Monorepo

Bienvenue dans le monorepo de KayyDrive, une application de navigation routière intelligente conçue pour les réalités africaines.

Ce dépôt contient les différents services qui composent l'architecture backend de KayyDrive.

##  Documentation

Pour plus d'informations détaillées, consultez :

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Architecture détaillée du projet, services, versions et modules
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Configuration Docker, déploiement et dépannage des conteneurs
- **[core-api/README.md](core-api/README.md)** - Documentation complète de l'API NestJS (routes, tests, stockage)

## Structure du Projet

- `core-api/`: Le service principal (NestJS) géré par Lionel, Cindy et Atouga. Il orchestre la navigation, gère les requêtes API et interagit avec les autres microservices.
- `ia-service/`: Le microservice d'Intelligence Artificielle (FastAPI/Python) géré par Danielle. Il est responsable des prédictions de trafic, de l'analyse des données et d'autres logiques IA.
- `docker-compose.yml`: orchestration Docker de développement, construit les images localement.
- `docker-compose.prod.yml`: orchestration à partir des images publiées sur GHCR, avec migrations Prisma.
- `start.ps1` / `start.sh`: initialisation `.env`, téléchargement des images et démarrage en une commande.
- `postgres/`: Configuration PostgreSQL avec pgAdmin intégré.

## Architecture

### Services Docker

- **PostgreSQL + PostGIS**: Base de données principale avec support géospatial
- **Redis**: Cache et gestion des sessions
- **pgAdmin**: Interface d'administration de la base de données
- **Core API (NestJS)**: API principale sur le port 3200
- **IA Service (FastAPI)**: Service d'IA sur le port 9820
- **MinIO**: Stockage objet sur le port 9000
- **Nginx**: Reverse proxy sur le port 80
- **OSRM Backend**: Service de routage sur le port 5000

### Base de Données

Le projet utilise PostgreSQL avec Prisma ORM pour la gestion des données. Toutes les opérations CRUD sont centralisées dans la base de données PostgreSQL.

**Firebase a été complètement supprimé du backend.** Toutes les données sont maintenant stockées et gérées via PostgreSQL, y compris :
- Relevés de trafic (collecte hybride : Waze temps réel + historique seedé)
- Prédictions de trafic (système à 3 niveaux de repli)
- Préférences utilisateur
- Adresses favorites
- Données Safe-Drive (secousses)
- Notifications (tokens FCM stockés en PostgreSQL)

**L'authentification est entièrement gérée par PostgreSQL avec JWT.**

## Démarrage rapide en local

### Prérequis

- Docker Desktop (Windows/macOS) ou Docker Engine + Docker Compose
- Node.js 22 et npm, uniquement pour lancer NestJS hors Docker
- Flutter 3.x, pour le dépôt frontend séparé
- Git
- Environ 8 Go de RAM disponibles pour la stack complète (PostgreSQL, OSRM, MinIO, IA)

### Option recommandée : images publiées

Le workflow `.github/workflows/publish-images.yml` publie automatiquement les images `core-api` et `ia-service` dans GitHub Container Registry (GHCR).

**Windows :**

```powershell
.\start.ps1
```

**Linux/macOS :**

```bash
chmod +x start.sh
./start.sh
```

Le script :

- crée `.env` depuis `.env.example` s'il n'existe pas ;
- génère les secrets locaux (`POSTGRES_PASSWORD`, `JWT_SECRET`) ;
- déduit `IMAGE_PREFIX` depuis le dépôt Git ;
- télécharge les images depuis GHCR ;
- applique les migrations Prisma ;
- démarre les services et attend que `core-api` soit sain.

Si les packages GHCR sont privés, connectez-vous d'abord :

```bash
docker login ghcr.io -u <votre-utilisateur-github>
```

Utilisez un token GitHub avec le scope `read:packages`, ou rendez les packages publics dans GitHub > Packages > Package settings.

Pour construire les images localement au lieu de les télécharger :

```powershell
.\start.ps1 -Build
```

```bash
./start.sh --build
```

Le frontend Flutter reste séparé : lancez-le avec `flutter run` et `API_URL=http://localhost:3200`.

### 1. Cloner et configurer le backend

```bash
git clone <URL_DU_DEPOT_BACKEND> kayyDrive
cd kayyDrive
cp .env.example .env
```

Sur Windows PowerShell :

```powershell
Copy-Item .env.example .env
```

Éditez ensuite le `.env` à la racine. Configuration locale minimale :

```env
POSTGRES_USER=kayydrive_user
POSTGRES_PASSWORD=kayydrive_local_password
POSTGRES_DB=kayydrive_db
DATABASE_URL=postgresql://kayydrive_user:kayydrive_local_password@postgres:5432/kayydrive_db
REDIS_URL=redis://redis:6379
OSRM_URL=http://osrm-backend:5000
IA_SERVICE_URL=http://ia-service:8000
CORS_ORIGINS=http://localhost:55555
JWT_SECRET=remplacez_par_le_secret_genere_ci_dessous
AUTH_2FA_REQUIRED=false
AUTH_EMAIL_VERIFICATION_REQUIRED=false
```

Générez un secret JWT :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Points importants :

- Les hôtes `postgres`, `redis`, `minio`, `osrm-backend` et `ia-service` sont les noms des services Docker. Ils ne sont joignables que depuis le réseau Docker.
- N'utilisez jamais une URL interne Render du type `dpg-xxxxx-a:5432` dans le `.env` local : elle n'est pas accessible depuis votre machine.
- `render.env` est réservé au déploiement Render, pas au développement local.
- Sans `BREVO_API_KEY`, les codes d'authentification sont écrits dans les logs du backend en développement.
- Les flags `AUTH_2FA_REQUIRED=false` et `AUTH_EMAIL_VERIFICATION_REQUIRED=false` sont utiles pour tester une version du frontend qui n'a pas encore l'interface 2FA. Repassez-les à `true` pour tester le flux complet.
- Si le mot de passe PostgreSQL contient des caractères spéciaux, encodez-le dans `DATABASE_URL`.

### 2. Générer les données OSRM

OSRM a besoin des données de routage du Cameroun. Elles ne sont pas versionnées dans Git car elles sont volumineuses.

**Windows :**

```powershell
.\generate-osrm-data.bat
```

**Linux/macOS :**

```bash
chmod +x generate-osrm-data.sh
./generate-osrm-data.sh
```

Cette étape télécharge les données OSM et génère les fichiers OSRM. Elle peut prendre plusieurs minutes. Sans ces fichiers, le conteneur `osrm-backend` ne démarrera pas.

### 3. Démarrer les services

Pour le backend et ses dépendances :

```bash
docker compose up -d --build postgres redis minio core-api ia-service
```

Pour toute la stack, OSRM et Nginx compris :

```bash
docker compose up -d --build
```

Au premier démarrage, `core-api` exécute automatiquement :

- `prisma generate` et `prisma db push` pour créer les tables ;
- `scripts/init-db.ts`, qui lance le seed si aucun administrateur n'existe.

Suivez le démarrage :

```bash
docker compose logs -f core-api
docker compose ps
```

Si vous lancez le backend directement avec `npm run start:dev`, il écoute sur le port `3000` et il faut renseigner `DATABASE_URL`, `REDIS_URL` et `JWT_SECRET` dans `core-api/.env`. Dans ce cas, utilisez `localhost` au lieu de `postgres`/`redis` et exposez Redis sur l'hôte si nécessaire ; sinon, préférez le lancement via Docker Compose.

### 4. Vérifier les services

| Service | URL locale |
|---|---|
| Core API | `http://localhost:3200` |
| Health check Core API | `http://localhost:3200/health` |
| Swagger | `http://localhost:3200/api/docs` |
| IA Service | `http://localhost:9820` |
| Health check IA | `http://localhost:9820/health` |
| OSRM | `http://localhost:5000` |
| MinIO API | `http://localhost:9000` |
| MinIO Console | `http://localhost:9001` |
| Nginx | `http://localhost` |

Le port **3200** est le port exposé sur la machine hôte ; à l'intérieur du réseau Docker, le core-api écoute sur **3000**. Utilisez donc `http://localhost:3200` depuis Flutter et `http://core-api:3000` entre conteneurs.

Comptes MinIO par défaut :

- Utilisateur : `minioadmin`
- Mot de passe : `minioadmin123`
- Bucket : `kayydrive`

### 5. Lancer le frontend Flutter en local

Le frontend est dans un dépôt séparé :

```bash
git clone <URL_DU_DEPOT_FRONTEND> KAYY_DRIVE
cd KAYY_DRIVE
flutter pub get
```

Pour Flutter Web :

```powershell
flutter run -d chrome --web-port=55555 `
  --dart-define=API_URL=http://localhost:3200
```

Pour l'émulateur Android :

```powershell
flutter run -d emulator-5554 `
  --dart-define=API_URL=http://10.0.2.2:3200
```

Pour un téléphone physique, utilisez l'adresse IP locale du PC et le même réseau Wi-Fi :

```powershell
flutter run --dart-define=API_URL=http://192.168.1.50:3200
```

Variables Flutter optionnelles :

```powershell
flutter run -d chrome --web-port=55555 `
  --dart-define=API_URL=http://localhost:3200 `
  --dart-define=IA_URL=http://localhost:9820 `
  --dart-define=OSRM_URL=http://localhost:5000 `
  --dart-define=STORAGE_URL=http://localhost:9000/kayydrive `
  --dart-define=GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
```

`API_URL` est une variable de compilation Flutter : elle se passe avec `--dart-define`, pas dans un fichier `.env`. Après modification, il faut relancer complètement `flutter run`, pas seulement un hot reload.

### 6. Créer l'administrateur initial

Avec la stack de développement, le seed est lancé automatiquement si aucun admin n'existe. Sinon :

```bash
docker compose exec core-api npm run seed
```

Le `docker-compose.prod.yml` ne lance pas le seed automatiquement. Après inscription, promouvez le compte en base si nécessaire :

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U <postgres_user> -d <postgres_db> -c "UPDATE \"Utilisateur\" SET role='admin' WHERE email='vous@example.com';"
```

Compte par défaut :

- Email : `admin@kayydrive.com`
- Mot de passe : `Admin123!`

Changez ce mot de passe après la première connexion.

### 7. Erreurs fréquentes

- **Docker Desktop n'est pas démarré** : lancez Docker Desktop et attendez que le moteur soit prêt.
- **`P1001: Can't reach database server`** : vérifiez que `DATABASE_URL` utilise `postgres:5432` et que le conteneur `postgres` est `healthy`.
- **Une URL `dpg-...` apparaît dans les logs** : une URL interne Render a été copiée dans le `.env` local. Remplacez-la par l'URL locale.
- **`port is already allocated`** : un autre service utilise déjà 3200, 5432, 6379, 9000, 9001, 9820, 5000 ou 80.
- **OSRM redémarre en boucle** : les données OSRM n'ont pas été générées.
- **`flutter pub get` bloque** : réessayez, ou utilisez `flutter pub get --offline` si les paquets sont déjà en cache.
- **Warning Redis `allkeys-lru`** : BullMQ recommande `noeviction`. Le warning n'empêche pas toujours le démarrage, mais peut faire perdre des jobs.

### 8. Construire et partager les images Docker

Un **conteneur** est une instance en cours d'exécution. Une **image** est le modèle versionnable à partir duquel on crée des conteneurs. On partage des images, pas des conteneurs.

Construire toutes les images du compose :

```bash
docker compose build
```

Construire une image individuellement :

```bash
# Backend en mode développement (hot reload)
docker build --target development -t kayydrive/core-api:dev ./core-api

# Backend en mode production
docker build -t kayydrive/core-api:1.0.0 ./core-api

# Service IA
docker build -t kayydrive/ia-service:1.0.0 ./ia-service
```

Publier une image dans GitHub Container Registry :

```bash
docker login ghcr.io -u <votre-utilisateur>
docker tag kayydrive/core-api:1.0.0 ghcr.io/<organisation>/kayydrive-core-api:1.0.0
docker push ghcr.io/<organisation>/kayydrive-core-api:1.0.0
```

Le workflow `.github/workflows/publish-images.yml` fait cela automatiquement pour `core-api` et `ia-service` à chaque push sur `develop`/`main` et pour les tags `v*`. Il publie aussi un tag basé sur le SHA du commit. Pour que les autres puissent télécharger sans authentification, rendez les packages publics dans GitHub > Packages > Package settings.

`docker-compose.prod.yml` utilise ces images via `IMAGE_PREFIX` et `IMAGE_TAG` définis dans `.env`.

Utilisez des tags de version explicites (`1.0.0`, `sha-abc123`) plutôt que uniquement `latest`. Les autres développeurs peuvent ensuite faire `docker pull` ou utiliser ces images dans un `docker-compose.override.yml`. Ne commitez jamais une image Docker dans Git.

### 9. Versionner la base de données

Il faut distinguer l'image PostgreSQL, le schéma et les données :

| Élément | À versionner | Où |
|---|---|---|
| Image PostgreSQL/PostGIS | Oui | `docker-compose.yml` avec `postgis/postgis:15-3.3` |
| Schéma de la base | Oui | `core-api/prisma/migrations` |
| Seed de démonstration | Oui | `core-api/prisma/seed.ts` et scripts associés |
| Données locales | Non | volume Docker local |
| Dump de production | Non | stockage sécurisé, jamais Git |

Une migration initiale est versionnée dans `core-api/prisma/migrations/20261117000000_init`. La stack de développement continue d'utiliser `prisma db push` pour le prototypage, tandis que `docker-compose.prod.yml` exécute `prisma migrate deploy` dans le service `migrate` avant de démarrer `core-api`.

Pour créer une nouvelle migration :

```bash
cd core-api
npx prisma migrate dev --name ajout_nouvelle_table
```

Puis committez le dossier `core-api/prisma/migrations`. En production et dans les environnements partagés, appliquez-les avec :

```bash
npx prisma migrate deploy
```

Si une base existante contient déjà les tables mais n'a pas d'historique Prisma, baselinez-la une seule fois avant `migrate deploy` :

```bash
npx prisma migrate resolve --applied 20261117000000_init
```

Évitez `prisma db push` sur une base partagée : il ne conserve pas d'historique de migration et peut casser le travail des autres.

Pour une base de démonstration préremplie, vous pouvez créer une image dédiée :

```dockerfile
FROM postgis/postgis:15-3.3
COPY init/ /docker-entrypoint-initdb.d/
```

Chaque développeur obtient alors une copie fraîche des données initiales au démarrage. Cette approche est adaptée aux démos et aux tests, mais pas à une base collaborative où plusieurs personnes écrivent en même temps. Pour un environnement partagé, préférez un staging Render avec une base ou un schéma par développeur.

### Minio (Stockage d'images)

Le projet utilise Minio pour le stockage des images (incidents, publicités, etc.).

**Accès à la console Minio :**
- URL : `http://localhost:9001`
- Utilisateur : `minioadmin`
- Mot de passe : `minioadmin123`

**Bucket par défaut :**
- Nom : `kayydrive`
- Créé automatiquement au démarrage du service

**Configuration des variables d'environnement :**
```bash
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=kayydrive
```

**Endpoint d'upload d'images :**
```
POST /storage/upload
Content-Type: multipart/form-data
```

**Exemple avec curl :**
```bash
curl -X POST http://localhost:3200/storage/upload \
  -F "file=@/path/to/image.jpg" \
  -F "folder=incidents"
```

**Réponse :**
```json
{
  "url": "http://localhost:9000/kayydrive/incidents/1234567890-image.jpg"
}
```

**Restrictions :**
- Types autorisés : JPEG, PNG, WebP, GIF
- Taille maximale : 5MB

### Vérifier l'état des services

Pour vérifier que tous les services sont lancés et fonctionnent normalement :

```bash
# Vérifier les conteneurs Docker actifs
docker ps

# Vérifier les logs d'un service spécifique
docker logs kayydrive-core-api-1
docker logs kayydrive-postgres
docker logs kayydrive-redis
```

Les services doivent afficher un statut "Up" et ne doivent pas avoir d'erreurs dans les logs.

### Configuration pgAdmin

pgAdmin est optionnel et commenté dans `docker-compose.yml`. Si vous l'activez :

1. Allez sur `http://localhost:5052`
2. Connectez-vous avec :
   - Email: `admin@example.com`
   - Mot de passe: `admin123`
3. Ajoutez un nouveau serveur avec les paramètres :
   - Hôte: `postgres`
   - Port: `5432`
   - Base de données: `kayydrive_db`
   - Utilisateur: `kayydrive_user`
   - Mot de passe: `kayydrive_secure_password_2026`

## Documentation API

L'API principale est accessible sur `http://localhost:3200`. Toutes les routes protégées nécessitent un JWT dans le header `Authorization: Bearer <token>`.

### Authentification

#### POST /auth/register
Inscription d'un nouvel utilisateur.

**Body :**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "nom": "John Doe",
  "telephone": "+237123456789"
}
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "uid": "uuid",
    "email": "user@example.com",
    "nom": "John Doe",
    "telephone": "+237123456789",
    "role": "user",
    "dateCreation": "2026-06-30T..."
  }
}
```

#### POST /auth/login
Connexion d'un utilisateur.

**Body :**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Réponse :**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "uuid",
    "email": "user@example.com",
    "nom": "John Doe",
    "prenom": "",
    "role": "user"
  }
}
```

#### GET /auth/me
Récupérer le profil de l'utilisateur connecté.

**Headers :**
```
Authorization: Bearer <token>
```

**Réponse :**
```json
{
  "user": {
    "uid": "uuid",
    "email": "user@example.com",
    "nom": "John Doe",
    "prenom": "",
    "role": "user"
  }
}
```

#### POST /auth/promote (Admin uniquement)
Changer le rôle d'un utilisateur.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "uid": "user-uuid",
  "role": "admin"
}
```

### Utilisateurs

#### POST /users/position
Mettre à jour la position de l'utilisateur.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

#### DELETE /users/position
Supprimer la position de l'utilisateur.

**Headers :**
```
Authorization: Bearer <token>
```

### Catégories

#### GET /categories
Récupérer toutes les catégories.

**Headers :**
```
Authorization: Bearer <token>
```

#### POST /categories (Admin uniquement)
Créer une nouvelle catégorie.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "nom": "Transport",
  "description": "Catégorie transport"
}
```

### Incidents

#### GET /incidents
Récupérer les incidents proches d'une position.

**Headers :**
```
Authorization: Bearer <token>
```

**Query params :**
```
latitude=3.8488
longitude=11.5021
rayon=5000
```

#### POST /incidents
Signaler un nouvel incident.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "type": "inondation",
  "description": "Route inondée",
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

#### POST /incidents/:id/confirmer
Confirmer un incident.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

### Routes

#### POST /routes
Créer un raccourci communautaire.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "nom": "Raccourci Yaoundé",
  "description": "Raccourci rapide",
  "pointDepart": { "latitude": 3.8488, "longitude": 11.5021 },
  "pointArrivee": { "latitude": 3.8500, "longitude": 11.5100 },
  "trace": [{ "latitude": 3.8490, "longitude": 11.5030 }]
}
```

#### POST /routes/:id/voter
Voter pour un raccourci.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "vote": "positif"
}
```

#### GET /routes/suggestions
Obtenir des suggestions de raccourcis.

**Query params :**
```
departLat=3.8488
departLng=11.5021
arriveeLat=3.8500
arriveeLng=11.5100
```

### Notifications

#### GET /notifications
Récupérer les notifications de l'utilisateur.

**Headers :**
```
Authorization: Bearer <token>
```

#### POST /notifications/token
Enregistrer un token FCM.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "token": "fcm_token_here"
}
```

#### PATCH /notifications/:id/lue
Marquer une notification comme lue.

**Headers :**
```
Authorization: Bearer <token>
```

### Préférences

#### GET /preferences
Récupérer les préférences de l'utilisateur.

**Headers :**
```
Authorization: Bearer <token>
```

#### PATCH /preferences
Mettre à jour les préférences.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "eviterPeages": true,
  "prioriserRoutesSecu": true,
  "eviterZonesInondables": true,
  "modeHorsLigneActif": false
}
```

### Adresses Favorites

#### GET /adresses-favorites
Récupérer les adresses favorites.

**Headers :**
```
Authorization: Bearer <token>
```

#### POST /adresses-favorites
Ajouter une adresse favorite.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "nom": "Maison",
  "adresse": "123 Rue Principale",
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

#### DELETE /adresses-favorites/:id
Supprimer une adresse favorite.

**Headers :**
```
Authorization: Bearer <token>
```

### Prédictions

#### GET /predictions
Prédire le trafic à un point donné.

**Headers :**
```
Authorization: Bearer <token>
```

**Query params :**
```
latitude=3.8488
longitude=11.5021
horodatage=2026-06-30T12:00:00Z
```

#### POST /predictions/itineraire
Prédire le trafic sur un itinéraire.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "points": [
    { "latitude": 3.8488, "longitude": 11.5021 },
    { "latitude": 3.8500, "longitude": 11.5100 }
  ],
  "horodatage": "2026-06-30T12:00:00Z"
}
```

**Réponse :**
```json
{
  "niveau_trafic": "dense",
  "temps_estime_minutes": 12.5,
  "confiance": 0.85,
  "predictions": [
    { "latitude": 3.8488, "longitude": 11.5021, "niveauPredit": "fluide" },
    { "latitude": 3.8500, "longitude": 11.5100, "niveauPredit": "dense" }
  ],
  "trafficHotspots": [
    { "location": { "lat": 3.85, "lon": 11.51 }, "severity": "moderate", "expectedDelay": 15 }
  ]
}
```

> **Système Hybride à 3 niveaux :**
> 1. **Waze LiveMap** (temps réel) — proxy vers `routing-livemap-row.waze.com` pour les vitesses réelles sur le trajet
> 2. **Historique local** — table `ReleveTrafic` seedée avec des données réalistes de Douala et Yaoundé
> 3. **Fallback statistique** — `modere` (25 km/h) si aucune donnée disponible

**Niveaux de trafic et couleurs :**
| Niveau | Vitesse | Couleur carte |
|--------|---------|---------------|
| `fluide` | ≥ 30 km/h | 🟢 Vert |
| `modere` | 15–29 km/h | 🟠 Orange |
| `dense` | 10–14 km/h | 🔴 Rouge |
| `bouchon` | < 10 km/h | 🟤 Rouge foncé |

### Trafic

#### GET /trafic
Récupérer le trafic actuel.

**Headers :**
```
Authorization: Bearer <token>
```

**Query params :**
```
latitude=3.8488
longitude=11.5021
rayon=5000
```

#### POST /trafic
Enregistrer un relevé de trafic.

**Headers :**
```
Authorization: Bearer <token>
```

**Body :**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021,
  "niveau": "eleve",
  "vitesseMoyenne": 15
}
```

## Navigation

Le module de navigation permet de calculer des itinéraires avec des fonctionnalités intelligentes.

### GET /route/basic
Calcul d'un itinéraire basique via OSRM.

**Query params :**
```
startLat=4.051
startLng=9.767
endLat=3.848
endLng=11.502
```

**Réponse :**
```json
{
  "duration": 1800,
  "distance": 15000,
  "geometry": { "type": "LineString", "coordinates": [...] },
  "instructions": [
    { "text": "Tourner à droite", "distance": 500, "duration": 60, "location": [...] }
  ],
  "suggestedLocalRoutes": [
    {
      "id": "route-id",
      "nom": "Raccourci Yaoundé",
      "description": "Raccourci rapide",
      "score": 4.5
    }
  ]
}
```

### GET /route/smart
Calcul d'un itinéraire intelligent avec toutes les fonctionnalités activées (Hydro-Guard, Safe-Drive, routes locales, trafic).

**Query params :**
```
startLat=4.051
startLng=9.767
endLat=3.848
endLng=11.502
```

**Réponse :**
```json
{
  "duration": 2100,
  "distance": 15000,
  "geometry": { "type": "LineString", "coordinates": [...] },
  "instructions": [
    { "text": "⚠️ 1 incident(s) signalé(s) sur votre trajet", "distance": 0, "duration": 0, "location": [...] },
    { "text": "Tourner à droite", "distance": 500, "duration": 60, "location": [...] },
    { "text": "💡 2 route(s) locale(s) alternative(s) disponible(s)", "distance": 0, "duration": 0, "location": [...] },
    { "text": "🚗 Trafic prévu: modéré (+5 min)", "distance": 0, "duration": 0, "location": [...] }
  ],
  "suggestedLocalRoutes": [
    {
      "id": "route-id",
      "nom": "Raccourci Yaoundé",
      "description": "Raccourci rapide",
      "score": 4.5
    }
  ],
  "incidentsOnRoute": [
    {
      "type": "travaux",
      "description": "Travaux sur N3",
      "latitude": 3.849,
      "longitude": 11.503,
      "statut": "confirme"
    }
  ],
  "trafficPrediction": {
    "niveau_trafic": "modéré",
    "temps_estime_minutes": 5,
    "confiance": 0.85
  },
  "smartFeatures": {
    "trafficEnabled": true,
    "localRoutesEnabled": true,
    "incidentsEnabled": true
  }
}
```

**Fonctionnalités intégrées dans /route/smart :**
- **Hydro-Guard** : Alertes d'incidents (inondations, travaux) sur le trajet
- **Routes locales** : Suggestions de raccourcis communautaires alternatifs
- **Prédictions de trafic** : Estimation du temps de trajet en fonction des conditions météo et de l'heure
- **Instructions enrichies** : Instructions de navigation avec alertes et suggestions
- **Maneuvers précis** : Instructions textuelles avec noms de rues pour le guidage vocal

### POST /route/reroute
Recalcule automatique l'itinéraire si l'utilisateur s'éloigne du tracé (plus de 50m).

**Body :**
```json
{
  "currentLat": 3.8488,
  "currentLng": 11.5021,
  "endLat": 3.8500,
  "endLng": 11.5100
}
```

**Réponse :**
```json
{
  "duration": 2100,
  "distance": 15000,
  "geometry": { "type": "LineString", "coordinates": [...] },
  "instructions": [...],
  "suggestedLocalRoutes": [...],
  "incidentsOnRoute": [...],
  "trafficPrediction": {...}
}
```

### POST /route/snap-to-road
Recale les coordonnées GPS sur la route la plus proche pour éviter que le point ne tremble.

**Body :**
```json
{
  "coordinates": [
    [11.5021, 3.8488],
    [11.5030, 3.8490],
    [11.5100, 3.8500]
  ]
}
```

**Réponse :**
```json
{
  "snappedCoordinates": [[11.5022, 3.8489], [11.5031, 3.8491], [11.5101, 3.8501]],
  "confidence": 0.95,
  "distance": 15000,
  "duration": 2100
}
```

## Routes Admin

Ces routes sont réservées aux administrateurs uniquement et nécessitent un token JWT avec le rôle `admin`.

### POST /auth/promote
Changer le rôle d'un utilisateur.

**Headers :**
```
Authorization: Bearer <admin_token>
```

**Body :**
```json
{
  "uid": "user-uuid",
  "role": "admin"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Rôle mis à jour : admin"
}
```

### POST /categories
Créer une nouvelle catégorie.

**Headers :**
```
Authorization: Bearer <admin_token>
```

**Body :**
```json
{
  "nom": "Transport",
  "icone": "🚌",
  "couleur": "#3B82F6",
  "ordre": 1
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Catégorie créée avec succès",
  "category": {
    "id": "uuid",
    "nom": "Transport",
    "icone": "🚌",
    "couleur": "#3B82F6",
    "ordre": 1
  }
}
```

### POST /ads
Création de la publicité.

**Headers :**
```
Authorization: Bearer <admin_token>
```

**Body :**
```json
{
  "titre": "Promotion KayyDrive",
  "description": "Offre spéciale pour les nouveaux utilisateurs",
  "type": "banner",
  "dateDebut": "2026-07-01T00:00:00Z",
  "dateFin": "2026-07-31T23:59:59Z"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Publicité créée avec succès",
  "ad": {
    "id": "uuid",
    "titre": "Promotion KayyDrive",
    "description": "Offre spéciale pour les nouveaux utilisateurs",
    "type": "banner",
    "dateDebut": "2026-07-01T00:00:00Z",
    "dateFin": "2026-07-31T23:59:59Z",
    "actif": true
  }
}
```

### DELETE /ads/:id
Supprimer une publicité.

**Headers :**
```
Authorization: Bearer <admin_token>
```

**Réponse :**
```json
{
  "success": true,
  "message": "Publicité supprimée"
}
```

### POST /rewards
Creation d'une récompense.

**Headers :**
```
Authorization: Bearer <admin_token>
```

**Body :**
```json
{
  "titre": "Bonus de bienvenue",
  "description": "100 points pour votre première inscription",
  "points": 100,
  "type": "inscription",
  "dateDebut": "2026-07-01T00:00:00Z",
  "dateFin": "2026-12-31T23:59:59Z"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Récompense créée avec succès",
  "reward": {
    "id": "uuid",
    "titre": "Bonus de bienvenue",
    "description": "100 points pour votre première inscription",
    "points": 100,
    "type": "inscription",
    "dateDebut": "2026-07-01T00:00:00Z",
    "dateFin": "2026-12-31T23:59:59Z",
    "actif": true
  }
}
```

### DELETE /rewards/:id
Supprimer une récompense.

**Headers :**
```
Authorization: Bearer <admin_token>
```

**Réponse :**
```json
{
  "success": true,
  "message": "Récompense supprimée"
}
```

## Création de l'administrateur initial

Pour créer le premier administrateur, utilisez le script de seed :

```bash
cd core-api
npm run seed
```

Cela créera :
- Un utilisateur admin avec l'email `admin@kayydrive.com`
- Mot de passe par défaut : `Admin123!`
- Des catégories par défaut (Domicile, Travail, École, Famille, Restaurant, Santé, Autre)

**Important :** Changez le mot de passe de l'admin après la première connexion en production.

## Seeding des données de trafic

Pour peupler la base de données `ReleveTrafic` avec des données historiques réalistes pour Douala et Yaoundé :

```bash
# Sans clé TomTom (simulation intelligente basée sur les heures de pointe)
docker exec -i kayydrive-core-api-1 npm run seed:trafic

# Avec une clé TomTom gratuite (données réelles si couverture disponible)
docker exec -i -e TOMTOM_API_KEY=votre_cle_api kayydrive-core-api-1 npm run seed:trafic
```

Le script génère **650+ enregistrements** sur les 7 derniers jours en couvrant les principaux carrefours :
- 🇨🇲 **Douala** : Ndokotti, Deido, Akwa, Bonabéri, Ancien Troisième
- 🇨🇲 **Yaoundé** : Rond-point Poste, Mvan, Bastos, Warda

**Obtenir une clé TomTom gratuite :**
1. S'inscrire sur [developer.tomtom.com](https://developer.tomtom.com/)
2. Créer un projet et copier la clé API
3. Plan gratuit : 2 500 transactions/jour (largement suffisant pour le seeding)

## Tests Unitaires

Le projet est configuré avec Jest pour les tests unitaires et d'intégration.

### Structure des Tests

```
core-api/
├── test/
│   ├── setup.ts                    # Configuration globale des tests
│   ├── helpers/
│   │   └── test-helpers.ts         # Helpers pour créer des données de test
│   └── mocks/
│       └── prisma.mock.ts          # Mocks pour Prisma
└── src/
    ├── auth/
    │   ├── auth.service.spec.ts    # Tests du service auth
    │   └── auth.controller.spec.ts # Tests du controller auth
    ├── categories/
    │   └── categories.service.spec.ts
    ├── dashboard/
    │   └── dashboard.service.spec.ts
    ├── incidents/
    │   └── incidents.service.spec.ts
    └── routes/
        └── routes.service.spec.ts
```

### Exécuter les Tests

**Tous les tests :**
```bash
cd core-api
npm test
```

**Tests en mode watch :**
```bash
npm run test:watch
```

**Tests avec couverture de code :**
```bash
npm run test:cov
```

**Tests d'un fichier spécifique :**
```bash
npm test auth.service.spec.ts
```

### Écrire des Tests

Chaque fichier de test suit cette structure :

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from './service-name.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServiceName', () => {
  let service: ServiceName;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: PrismaService,
          useValue: {
            // Mock methods here
          },
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // TODO: Add more tests
});
```

### Helpers de Test

Des helpers sont disponibles dans `test/helpers/test-helpers.ts` pour créer facilement des données de test :

- `createTestUser()` - Crée un utilisateur de test
- `createTestAdmin()` - Crée un admin de test
- `createTestCategory()` - Crée une catégorie de test
- `createTestIncident()` - Crée un incident de test
- `createTestShortcut()` - Crée un raccourci de test
- `cleanupTestData()` - Nettoie toutes les données de test

## Dashboard Admin

Le dashboard admin fournit des métriques et statistiques pour analyser l'efficacité de l'application KayyDrive dans la résolution des problèmes de navigation routière.

Toutes les routes du dashboard nécessitent un token JWT avec le rôle `admin`.

### GET /dashboard/all
Récupérer toutes les statistiques du dashboard en un seul appel.

**Headers :**
```
Authorization: Bearer <admin_token>
```

**Réponse :**
```json
{
  "overview": {
    "totalUsers": 1500,
    "activeUsers": 850,
    "totalIncidents": 120,
    "totalRoutes": 45
  },
  "incidents": {
    "confirmedIncidents": 85,
    "incidentsByType": {
      "accident": 40,
      "inondation": 25,
      "travaux": 20
    }
  },
  "performance": {
    "averageResponseTime": 150,
    "uptime": 99.5,
    "errorRate": 0.5
  }
}
```

### GET /dashboard/overview
Statistiques générales du système.

**Réponse :**
```json
{
  "totalUsers": 1250,
  "activeUsers24h": 85,
  "activeUsers7d": 320,
  "activeUsers30d": 580,
  "activeSessions": 42,
  "totalDistanceKm": 15420.5,
  "incidentsToday": 12,
  "totalShortcuts": 156,
  "incidentConfirmationRate": 78.5
}
```

### GET /dashboard/shortcuts
Statistiques des raccourcis communautaires.

**Réponse :**
```json
{
  "totalShortcuts": 156,
  "averageReliabilityScore": 4.2,
  "adoptionRate": 65.8,
  "topShortcuts": [
    {
      "id": "uuid",
      "nom": "Raccourci Bastos - Mvan",
      "description": "Évite les embouteillages de l'avenue Kennedy",
      "scoreFiabilite": 4.8,
      "votesPositifs": 45,
      "votesNegatifs": 2,
      "createurNom": "Jean Dupont"
    }
  ]
}
```

### GET /dashboard/incidents
Statistiques des incidents (Hydro-Guard).

**Réponse :**
```json
{
  "incidentsByType": [
    { "type": "INONDATION", "count": 45, "percentage": 35.2 },
    { "type": "QUALITE_ROUTE", "count": 52, "percentage": 40.6 },
    { "type": "TRAFIC", "count": 31, "percentage": 24.2 }
  ],
  "confirmationRate": 78.5,
  "confirmedIncidents": 98,
  "pendingIncidents": 30,
  "incidentsLast7Days": [
    { "date": "2026-06-25", "count": 15 },
    { "date": "2026-06-26", "count": 18 },
    { "date": "2026-06-27", "count": 22 }
  ]
}
```

### GET /dashboard/safe-drive
Statistiques Safe-Drive (qualité des routes).

**Réponse :**
```json
{
  "averageQualityScore": 0.75,
  "floodedRoutesCount": 12,
  "degradedRoutesCount": 28,
  "averageSpeedByRouteType": [
    { "routeType": "officiel", "averageSpeed": 35.5, "segmentCount": 450 },
    { "routeType": "local", "averageSpeed": 28.2, "segmentCount": 320 }
  ],
  "riskLevelDistribution": [
    { "riskLevel": "SUR", "count": 120, "percentage": 45.0 },
    { "riskLevel": "MODERE", "count": 98, "percentage": 36.8 },
    { "riskLevel": "RISQUE_INONDATION", "count": 35, "percentage": 13.1 },
    { "riskLevel": "ROUTE_DEGRADEE", "count": 13, "percentage": 4.9 }
  ]
}
```

### GET /dashboard/engagement
Statistiques d'engagement utilisateur.

**Réponse :**
```json
{
  "topContributors": [
    {
      "id": "uuid",
      "pseudo": "Marie Curie",
      "email": "marie@example.com",
      "scoreReputation": 850,
      "incidentsReported": 45,
      "shortcutsCreated": 12,
      "votesCount": 78
    }
  ],
  "averageReportsPerUser": 2.3,
  "averageVotesPerUser": 5.8,
  "totalFavoriteAddresses": 890,
  "usersWithFavorites": 420
}
```

### GET /dashboard/performance
Statistiques de performance système.

**Réponse :**
```json
{
  "averageRouteResponseTime": 0,
  "osrmSuccessRate": 95,
  "totalRouteRequests": 5420,
  "trafficPredictionUsage": 0,
  "notificationsSent24h": 156,
  "activeFcmTokens": 380
}
```

## Développement

Chaque service a son propre `package.json` (pour Node.js) ou `requirements.txt` (pour Python) et peut être développé indépendamment.

### Core API (NestJS)

Pour développer l'API NestJS sans Docker :

1. Naviguez dans le dossier `core-api/`:
   ```bash
   cd core-api
   ```
2. Installez les dépendances :
   ```bash
   npm install --legacy-peer-deps
   ```
3. Configurez les variables d'environnement dans `.env`
4. Générez le client Prisma :
   ```bash
   npx prisma generate
   ```
5. Démarrez l'application en mode développement :
   ```bash
   npm run start:dev
   ```

### IA Service (FastAPI)

Pour développer le service IA (voir la documentation spécifique de Danielle).

### Prisma ORM

Le projet utilise Prisma v5 pour la gestion de la base de données. Les modèles sont définis dans `core-api/prisma/schema.prisma`.

Commandes Prisma utiles :
```bash
# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate dev

# Ouvrir Prisma Studio
npx prisma studio
```

## Services Migrés vers Prisma

Les services suivants ont été migrés de Firebase vers Prisma :
- **CategoriesService**: Gestion des catégories
- **UsersService**: Positions utilisateur
- **NotificationsService**: Données de notifications et tokens FCM
- **IncidentsService**: CRUD des incidents
- **RoutesService**: Raccourcis communautaires et votes
- **AuthService**: Authentification complète (inscription, connexion, JWT)

## Contribution

Veuillez suivre les directives de contribution de l'équipe.

## Sécurité

- Le fichier `.env` contient des secrets et ne doit pas être commité
- Utilisez `.env.example` comme template pour la configuration
- Les mots de passe doivent être modifiés en production
- Le JWT_SECRET doit être une chaîne aléatoire forte en production
