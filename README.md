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

### Base de Données

Le projet utilise PostgreSQL avec Prisma ORM pour la gestion des données. Toutes les opérations CRUD sont centralisées dans la base de données PostgreSQL.

**Firebase est conservé uniquement pour :**
- Authentification utilisateur (Firebase Auth)
- Envoi de notifications push (Firebase Messaging)

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
   PGADMIN_DEFAULT_EMAIL=admin@example.com
   PGADMIN_DEFAULT_PASSWORD=admin123
   ```

3. **Démarrer les services avec Docker Compose :**
   ```bash
   docker-compose up --build
   ```
   Ceci construira les images Docker et démarrera tous les services définis dans `docker-compose.yml`.

4. **Accéder aux services :**
   - **Core API (NestJS):** `http://localhost:4000`
   - **IA Service (FastAPI):** `http://localhost:9000`
   - **pgAdmin:** `http://localhost:5050`
   - **Nginx:** `http://localhost:80`

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
- **AuthService**: Profils utilisateur

## Contribution

Veuillez suivre les directives de contribution de l'équipe.

## Sécurité

- Le fichier `.env` contient des secrets et ne doit pas être commité
- Utilisez `.env.example` comme template pour la configuration
- Les mots de passe doivent être modifiés en production
