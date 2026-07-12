# KayyDrive - Architecture du Projet

## Vue d'ensemble

KayyDrive est une application de navigation intelligente pour le Cameroun, composée de plusieurs micro-services interconnectés via Docker.

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│                    (Application Web/Mobile)                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (Port 80)                         │
│                   Reverse Proxy + CORS                       │
└──────┬──────────────────────┬───────────────────────────────┘
       │                      │
       │ /api/*               │ /ia/*
       ▼                      ▼
┌──────────────────┐  ┌──────────────────┐
│   Core-API       │  │   IA-Service     │
│   (NestJS)       │  │   (FastAPI)      │
│   Port 3001      │  │   Port 9820      │
└──────┬───────────┘  └──────┬───────────┘
       │                    │
       │                    │
       ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL (PostGIS) - Port 5432               │
│              Base de données géospatiale                    │
└─────────────────────────────────────────────────────────────┘
       │
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Redis - Port 6379                           │
│              BullMQ (Queue de tâches)                       │
└─────────────────────────────────────────────────────────────┘
       │
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Minio - Ports 9000-9001                    │
│              Stockage d'images (S3-compatible)              │
└─────────────────────────────────────────────────────────────┘
```

## Services et Versions

### 1. Core-API (NestJS)

**Version :** 0.0.1  
**Framework :** NestJS 11.0.1  
**Runtime :** Node.js 22  
**Port interne :** 3000  
**Port externe :** 3001  

**Dépendances principales :**
- `@nestjs/common` ^11.0.1
- `@nestjs/core` ^11.0.1
- `@nestjs/bullmq` ^11.0.4
- `@prisma/client` ^7.8.0
- `@prisma/adapter-pg` ^7.8.0
- `axios` ^1.6.0
- `bullmq` ^5.79.2
- `pg` ^8.22.0

**Modules :**

#### AuthModule
- **Contrôleur :** `AuthController`
- **Service :** AuthService
- **Routes :**
  - `POST /auth/register` - Inscription utilisateur
  - `GET /auth/me` - Profil utilisateur
  - `POST /auth/promote` - Promotion admin

#### NavigationModule
- **Contrôleur :** NavigationController
- **Services :** NavigationService, NavigationParserService, LocalRoutesService
- **Routes :**
  - `GET /route/basic` - Itinéraire basique
  - `GET /route/smart` - Itinéraire intelligent

#### RoutesModule
- **Contrôleur :** RoutesController
- **Service :** RoutesService
- **Routes :**
  - `POST /routes` - Créer une route
  - `GET /routes/suggestions` - Suggestions de routes
  - `POST /routes/:id/voter` - Voter pour une route

#### IncidentsModule
- **Contrôleur :** IncidentsController
- **Service :** IncidentsService
- **Routes :**
  - `GET /incidents` - Liste des incidents
  - `POST /incidents` - Signaler un incident
  - `POST /incidents/:id/confirmer` - Confirmer un incident

#### SafeDriveModule
- **Contrôleur :** SafeDriveController
- **Service :** SafeDriveService
- **Processor :** SafeDriveProcessor (BullMQ)
- **Routes :**
  - `POST /safe-drive/secousse` - Signaler une secousse

#### TraficModule
- **Contrôleur :** TraficController
- **Service :** TraficService
- **Routes :**
  - `GET /trafic` - Données de trafic
  - `POST /trafic` - Signaler du trafic

#### PredictionsModule
- **Contrôleur :** PredictionsController
- **Service :** PredictionsService
- **Routes :**
  - `GET /predictions` - Prédictions générales
  - `POST /predictions/itineraire` - Prédictions d'itinéraire

#### NotificationsModule
- **Contrôleur :** NotificationsController
- **Service :** NotificationsService
- **Routes :**
  - `GET /notifications` - Liste des notifications
  - `POST /notifications/token` - Enregistrer token FCM
  - `PATCH /notifications/:id/lue` - Marquer comme lue

#### UsersModule
- **Contrôleur :** UsersController
- **Service :** UsersService
- **Routes :**
  - `POST /users/position` - Mettre à jour position
  - `DELETE /users/position` - Supprimer position

#### PreferencesModule
- **Contrôleur :** PreferencesController
- **Service :** PreferencesService
- **Routes :**
  - `GET /preferences` - Récupérer préférences
  - `PATCH /preferences` - Mettre à jour préférences

#### CategoriesModule
- **Contrôleur :** CategoriesController
- **Service :** CategoriesService
- **Routes :**
  - `GET /categories` - Liste des catégories
  - `POST /categories` - Créer une catégorie

#### AdsModule
- **Contrôleur :** AdsController
- **Service :** AdsService
- **Routes :**
  - `POST /ads` - Créer une publicité
  - `GET /ads` - Liste des publicités
  - `DELETE /ads/:id` - Supprimer une publicité

#### RewardsModule
- **Contrôleur :** RewardsController
- **Service :** RewardsService
- **Routes :**
  - `POST /rewards` - Créer une récompense
  - `GET /rewards` - Liste des récompenses
  - `DELETE /rewards/:id` - Supprimer une récompense

#### OfflineModule
- **Contrôleur :** OfflineController
- **Service :** OfflineService
- **Routes :**
  - `GET /offline/zones` - Liste des zones hors ligne
  - `GET /offline/zones/:zoneId/metadata` - Métadonnées zone
  - `GET /offline/zones/:zoneId/download` - Télécharger zone
  - `POST /offline/zones/:zoneId/generate` - Générer zone MBTiles

#### AdressesFavoritesModule
- **Contrôleur :** AdressesFavoritesController
- **Service :** AdressesFavoritesService
- **Routes :**
  - `GET /adresses-favorites` - Liste des adresses favorites
  - `POST /adresses-favorites` - Ajouter adresse favorite
  - `DELETE /adresses-favorites/:id` - Supprimer adresse favorite

#### DashboardModule
- **Contrôleur :** DashboardController
- **Service :** DashboardService
- **Routes :**
  - `GET /dashboard/overview` - Vue d'ensemble
  - `GET /dashboard/shortcuts` - Raccourcis communautaires
  - `GET /dashboard/incidents` - Statistiques incidents
  - `GET /dashboard/safe-drive` - Statistiques Safe-Drive
  - `GET /dashboard/engagement` - Engagement utilisateurs
  - `GET /dashboard/performance` - Performance système
  - `GET /dashboard/all` - Toutes les statistiques

#### StorageModule
- **Contrôleur :** StorageController
- **Service :** StorageService
- **Routes :**
  - `POST /storage/upload` - Upload d'images

### 2. IA-Service (FastAPI)

**Version :** Non spécifiée  
**Framework :** FastAPI 0.104.1  
**Runtime :** Python 3.9  
**Port interne :** 8000  
**Port externe :** 9820  

**Dépendances principales :**
- `fastapi` 0.104.1
- `uvicorn[standard]` 0.24.0
- `numpy` 1.26.4
- `scikit-learn` 1.3.2
- `pydantic` 2.5.0
- `h5py`
- `python-dotenv` 1.0.0

**Modules :**
- `app.main` - Point d'entrée FastAPI
- `app.ml.pothole_filter` - Détection de nids-de-poule
- Autres modules ML pour l'analyse de données

**Routes :**
- Disponibles via Nginx : `http://localhost/ia/*`

### 3. PostgreSQL (PostGIS)

**Version :** postgis/postgis:15-3.3  
**Port :** 5432  
**Base de données :** kayydrive_db  
**Utilisateur :** kayydrive_user  

**Extensions :**
- PostGIS (données géospatiales)

**Modèles Prisma :**
- `Utilisateur` - Utilisateurs de l'application
- `PreferencesUtilisateur` - Préférences utilisateur
- `SessionNavigation` - Sessions de navigation
- `Itineraire` - Itinéraires enregistrés
- `SegmentRoute` - Segments de routes avec géométrie
- `Incident` - Incidents signalés
- `Publicite` - Publicités
- `Recompense` - Récompenses

### 4. Redis

**Version :** redis:7-alpine  
**Port :** 6379  
**Usage :** BullMQ pour les queues de tâches (SafeDrive)

### 5. Nginx

**Version :** nginx:alpine  
**Port :** 80  
**Rôle :** Reverse Proxy + CORS + Rate Limiting

**Configuration :**
- Upstream `core-api` : core-api:3000
- Upstream `ia-service` : ia-service:8000
- Rate limiting : 10 req/s par IP
- CORS headers configurés

## Docker Compose

### Fichier principal : `docker-compose.yml`

**Services configurés :**
- `core-api` - API NestJS
- `ia-service` - API FastAPI
- `postgres` - PostgreSQL avec PostGIS
- `redis` - Redis pour BullMQ
- `minio` - Stockage d'images S3-compatible
- `nginx` - Reverse Proxy

**Réseaux :**
- `kayydrive-network` - Réseau bridge interne

**Volumes :**
- `postgres-data` - Données PostgreSQL persistantes
- `redis-data` - Données Redis persistantes
- `core-api-node-modules` - Node modules pour hot-reload
- `minio-data` - Données Minio persistantes

### Fichiers d'environnement

**`.env` (racine du projet) :**
```env
POSTGRES_USER=kayydrive_user
POSTGRES_PASSWORD=kayydrive_secure_password_2026
POSTGRES_DB=kayydrive_db
DATABASE_URL=postgresql://kayydrive_user:kayydrive_secure_password_2026@postgres:5432/kayydrive_db
REDIS_URL=redis://redis:6379
PORT=3000
NODE_ENV=development
OSRM_URL=http://osrm-backend:5000
IA_SERVICE_URL=http://ia-service:8000
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=kayydrive
JWT_SECRET=your_jwt_secret_key
FIREBASE_ADMIN_CONFIG=
PYTHON_ENV=development
GEMINI_API_KEY=<votre_clé>
```

**`postgres/.env` :**
```env
POSTGRES_USER=kayydrive_user
POSTGRES_PASSWORD=kayydrive_secure_password_2026
POSTGRES_DB=kayydrive_db
POSTGRES_PORT=5432
POSTGRES_HOST=postgres
```

## Lancer le Projet

### Avec Docker (Recommandé)

```bash
# Démarrer tous les services
docker-compose up -d

# Voir l'état des services
docker-compose ps

# Voir les logs d'un service
docker-compose logs core-api
docker-compose logs ia-service
docker-compose logs postgres

# Arrêter tous les services
docker-compose down

# Arrêter et supprimer les volumes
docker-compose down -v
```

### Sans Docker (Développement local)

**Core-API :**
```bash
cd core-api
npm install --legacy-peer-deps
npx prisma generate
npm run start:dev
```

**IA-Service :**
```bash
cd ia-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**PostgreSQL :**
```bash
# Via Docker ou installation locale
# Assurez-vous que PostGIS est installé
```

**Redis :**
```bash
# Via Docker ou installation locale
redis-server
```

## Routes API

### Via Nginx (Port 80)

**Core API :**
- `GET http://localhost/api/route/basic` - Itinéraire basique
- `GET http://localhost/api/route/smart` - Itinéraire intelligent
- `GET http://localhost/api/incidents` - Incidents
- `POST http://localhost/api/incidents` - Signaler incident
- `GET http://localhost/api/trafic` - Trafic
- `POST http://localhost/api/safe-drive/secousse` - Secousse
- `GET http://localhost/api/predictions` - Prédictions
- `GET http://localhost/api/notifications` - Notifications
- `GET http://localhost/api/users/position` - Position utilisateur
- `GET http://localhost/api/preferences` - Préférences
- `GET http://localhost/api/categories` - Catégories
- `GET http://localhost/api/ads` - Publicités
- `GET http://localhost/api/rewards` - Récompenses
- `GET http://localhost/api/offline/zones` - Zones hors ligne
- `GET http://localhost/api/adresses-favorites` - Adresses favorites
- `POST http://localhost/api/auth/register` - Inscription
- `GET http://localhost/api/auth/me` - Profil

**IA Service :**
- `GET http://localhost/ia/*` - Routes IA (dépend de l'implémentation)

**Health Check :**
- `GET http://localhost/health` - Vérifier l'état des services

### Directement (Ports exposés)

**Core-API :**
- `http://localhost:3001/*`

**IA-Service :**
- `http://localhost:9820/*`

**Minio :**
- Console : `http://localhost:9001`
- API : `http://localhost:9000`

**PostgreSQL :**
- `localhost:5432`

**Redis :**
- `localhost:6379`

## Scripts Utiles

**Core-API :**
```bash
npm run build              # Compiler le projet
npm run start:dev         # Mode développement avec hot-reload
npm run start:prod        # Mode production
npm run lint              # Linter le code
npm run test              # Tests unitaires
npm run seed:categories   # Seeder les catégories
npm run create:first-admin # Créer le premier admin
```

**Prisma :**
```bash
npx prisma generate       # Générer le client Prisma
npx prisma migrate dev    # Appliquer les migrations
npx prisma studio         # Ouvrir Prisma Studio
```

## Sécurité

- **PostgreSQL :** Mot de passe configuré dans `.env`
- **Redis :** Pas d'authentification (environnement de développement)
- **Firebase :** Optionnel, désactivé si `FIREBASE_ADMIN_CONFIG` non défini
- **Nginx :** Rate limiting activé (10 req/s par IP)

## Notes Importantes

- **OSRM Backend :** Désactivé pour le moment (données manquantes)
- **Firebase :** Optionnel pour les notifications push
- **Hot-reload :** Activé pour Core-API et IA-Service en développement
- **Volumes :** Les données PostgreSQL et Redis sont persistantes
