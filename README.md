# KayyDrive Monorepo

Bienvenue dans le monorepo de KayyDrive, une application de navigation routière intelligente conçue pour les réalités africaines.

Ce dépôt contient les différents services qui composent l'architecture backend de KayyDrive.

## Structure du Projet

- `core-api/`: Le service principal (NestJS) géré par Lionel, Cindy et Atouga. Il orchestre la navigation, gère les requêtes API et interagit avec les autres microservices.
- `ia-service/`: Le microservice d'Intelligence Artificielle (FastAPI/Python) géré par Danielle. Il est responsable des prédictions de trafic, de l'analyse des données et d'autres logiques IA.
- `docker-compose.yml`: Fichier d'orchestration Docker pour démarrer et gérer tous les services.
- `postgres/`: Configuration PostgreSQL avec pgAdmin intégré.

## Architecture

### Services Docker

- **PostgreSQL + PostGIS**: Base de données principale avec support géospatial
- **Redis**: Cache et gestion des sessions
- **pgAdmin**: Interface d'administration de la base de données
- **Core API (NestJS)**: API principale sur le port 4000
- **IA Service (FastAPI)**: Service d'IA sur le port 9000
- **Nginx**: Reverse proxy sur le port 80
- **OSRM Backend**: Service de routage sur le port 5000

### Base de Données

Le projet utilise PostgreSQL avec Prisma ORM pour la gestion des données. Toutes les opérations CRUD sont centralisées dans la base de données PostgreSQL.

**Firebase est conservé uniquement pour :**
- Envoi de notifications push (Firebase Messaging)

**L'authentification est entièrement gérée par PostgreSQL avec JWT.**

## Démarrage Rapide

1. **Cloner le dépôt :**
   ```bash
   git clone [URL_DU_DEPOT]
   cd kayyDrive
   ```

2. **Configuration des variables d'environnement :**
   Créez un fichier `.env` à la racine du projet en vous basant sur `.env.example` :
   ```bash
   cp .env.example .env
   ```
   
   Éditez le fichier `.env` avec vos valeurs :
   ```env
   POSTGRES_USER=kayydrive_user
   POSTGRES_PASSWORD=kayydrive_secure_password_2026
   POSTGRES_DB=kayydrive_db
   DATABASE_URL=postgresql://kayydrive_user:kayydrive_secure_password_2026@postgres:5432/kayydrive_db
   REDIS_URL=redis://redis:6379
   OSRM_URL=http://osrm-backend:5000
   IA_SERVICE_URL=http://ia-service:8000
   JWT_SECRET=your_jwt_secret_key_change_in_production
   PGADMIN_DEFAULT_EMAIL=admin@example.com
   PGADMIN_DEFAULT_PASSWORD=admin123
   ```

3. **Générer les données OSRM (optionnel mais recommandé) :**
   
   Le service OSRM nécessite des données de routage pour fonctionner. Pour générer les données du Cameroun :
   
   **Sur Windows :**
   ```bash
   .\generate-osrm-data.bat
   ```
   
   **Sur Linux/Mac :**
   ```bash
   chmod +x generate-osrm-data.sh
   ./generate-osrm-data.sh
   ```
   
   Cette commande télécharge les données OSM du Cameroun depuis Geofabrik et génère les fichiers OSRM nécessaires. Le processus peut prendre plusieurs minutes.

4. **Démarrer les services avec Docker Compose :**
   ```bash
   docker-compose up --build
   ```
   Ceci construira les images Docker et démarrera tous les services définis dans `docker-compose.yml`.

5. **Accéder aux services :**
   - **Core API (NestJS):** `http://localhost:4000`
   - **IA Service (FastAPI):** `http://localhost:9000`
   - **pgAdmin:** `http://localhost:5050`
   - **Nginx:** `http://localhost:80`
   - **OSRM Backend:** `http://localhost:5000`

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

Pour accéder à pgAdmin :
1. Allez sur `http://localhost:5050`
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

L'API principale est accessible sur `http://localhost:4000`. Toutes les routes protégées nécessitent un JWT dans le header `Authorization: Bearer <token>`.

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
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "uuid",
    "email": "user@example.com",
    "nom": "John Doe",
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
  "categorie": {
    "id": "uuid",
    "nom": "Transport",
    "icone": "🚌",
    "couleur": "#3B82F6",
    "ordre": 1
  }
}
```

### POST /ads
Créer une publicité.

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
  "id": "uuid",
  "titre": "Promotion KayyDrive",
  "description": "Offre spéciale pour les nouveaux utilisateurs",
  "type": "banner",
  "dateDebut": "2026-07-01T00:00:00Z",
  "dateFin": "2026-07-31T23:59:59Z",
  "actif": true
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
Créer une récompense.

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
  "id": "uuid",
  "titre": "Bonus de bienvenue",
  "description": "100 points pour votre première inscription",
  "points": 100,
  "type": "inscription",
  "dateDebut": "2026-07-01T00:00:00Z",
  "dateFin": "2026-12-31T23:59:59Z",
  "actif": true
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
