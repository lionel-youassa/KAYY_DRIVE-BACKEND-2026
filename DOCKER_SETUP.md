# KayyDrive Docker Architecture

## Overview

Cette architecture Docker permet de déployer tous les services KayyDrive dans des conteneurs isolés qui communiquent entre eux via un réseau Docker interne.

## Architecture

```
Frontend → Nginx (80) → Core-API (3200)
                        → IA-Service (9820)
OSRM direct (5000)

Core-API ↔ PostgreSQL (5432)
Core-API ↔ Redis (6379)
Core-API ↔ Minio (9000-9001)
IA-Service ↔ PostgreSQL (5432)
```

## Services

### 1. Core-API (NestJS)
- **Port interne**: 3000
- **Port externe**: 3200
- **Dépendances**: PostgreSQL, Redis, Minio
- **Routes API**: `/api/*` via Nginx, ou directement `http://localhost:3200/*`

### 2. IA-Service (FastAPI)
- **Port interne**: 8000
- **Port externe**: 9820
- **Dépendances**: PostgreSQL
- **Routes API**: `/ia/*`

### 3. OSRM Backend
- **Port externe**: 5000
- **Image**: osrm/osrm-backend:latest
- **Accès**: `http://localhost:5000` (pas de proxy Nginx)
- **Prérequis**: données OSRM générées avec `generate-osrm-data.bat` ou `.sh`

### 4. PostgreSQL (PostGIS)
- **Port**: 5432
- **Image**: postgis/postgis:15-3.3
- **Base de données**: kayydrive_db
- **Utilisateur**: kayydrive_user

### 5. Redis
- **Port interne**: 6379 (non exposé sur la machine hôte)
- **Image**: redis:7-alpine
- **Usage**: BullMQ queues

### 6. Minio
- **Ports**: 9000 (API), 9001 (Console)
- **Image**: minio/minio:latest
- **Usage**: Stockage d'images S3-compatible
- **Bucket par défaut**: kayydrive
- **Accès console**: http://localhost:9001
- **Identifiants**: minioadmin / minioadmin123

### 7. Nginx (Reverse Proxy)
- **Port**: 80
- **Image**: nginx:alpine
- **Rôle**: Point d'entrée unique, CORS, rate limiting

## Démarrage

Le guide complet, y compris le lancement du frontend Flutter en local, se trouve dans le [README principal](README.md#démarrage-rapide-en-local).

### Prérequis
- Docker Desktop installé et démarré
- Docker Compose installé
- Données OSRM générées si vous lancez le service `osrm-backend`

### Configuration

1. Copier le fichier d'environnement :
```bash
cp .env.example .env
```

2. Configurer les variables dans `.env` si nécessaire

### Démarrer tous les services

```bash
docker compose up -d --build
```

Pour démarrer uniquement le backend et ses dépendances :

```bash
docker compose up -d --build postgres redis minio core-api ia-service
```

Au premier démarrage, `core-api` exécute `prisma db push` puis le seed si aucun administrateur n'existe.

### Démarrer avec les images publiées

Pour utiliser les images publiées sur GHCR sans reconstruire le code :

```bash
# Windows
.\start.ps1

# Linux/macOS
./start.sh
```

Le fichier `docker-compose.prod.yml` contient les services de la stack publiée. Il exécute les migrations Prisma dans le service `migrate`, utilise des volumes persistants et n'expose pas PostgreSQL ni Redis sur l'hôte.

### Vérifier l'état des services

```bash
docker compose ps
```

### Voir les logs

```bash
# Tous les services
docker compose logs -f

# Service spécifique
docker compose logs -f core-api
docker compose logs -f postgres
```

### Arrêter les services

```bash
docker compose down
```

### Arrêter et supprimer les volumes

```bash
docker compose down -v
```

Attention : `-v` supprime la base de données locale et les fichiers MinIO.

## Accès aux API

Une fois les services démarrés :

- **Core API directe**: http://localhost:3200
- **Swagger**: http://localhost:3200/api/docs
- **Core API via Nginx**: http://localhost/api/
- **IA Service via Nginx**: http://localhost/ia/
- **IA Service directe**: http://localhost:9820
- **OSRM direct**: http://localhost:5000
- **Health Check Nginx**: http://localhost/health

## Développement

### Mode développement

Le mode développement est activé par défaut avec :
- Hot-reload pour Core-API
- Volumes montés pour le code source
- Logs en temps réel

### Mode production

Pour passer en mode production, modifiez le docker-compose.yml :

```yaml
core-api:
  build:
    target: production
```

## Dépannage

### PostgreSQL ne démarre pas

```bash
# Vérifier les logs
docker compose logs postgres

# Recréer le volume
docker compose down -v
docker compose up -d postgres
```

### Redis ne démarre pas

```bash
# Vérifier les logs
docker compose logs redis

# Recréer le volume
docker compose down -v
docker compose up -d redis
```

### Core-API ne peut pas se connecter à PostgreSQL

Vérifiez que :
1. PostgreSQL est démarré : `docker compose ps postgres`
2. L'URL de connexion est correcte dans `.env`
3. Les healthchecks sont passés

### Accéder à un conteneur

```bash
# Core-API
docker compose exec core-api sh

# PostgreSQL
docker compose exec postgres psql -U kayydrive_user -d kayydrive_db

# Redis
docker compose exec redis redis-cli
```

## Variables d'environnement

Toutes les variables sont définies dans `.env` :

- `DATABASE_URL` - URL de connexion PostgreSQL
- `REDIS_URL` - URL de connexion Redis
- `OSRM_URL` - URL du service OSRM
- `IA_SERVICE_URL` - URL du service IA
- `JWT_SECRET` - Secret de signature des JWT (obligatoire)
- `CORS_ORIGINS` - Origines autorisées pour Flutter Web
- `AUTH_2FA_REQUIRED` / `AUTH_EMAIL_VERIFICATION_REQUIRED` - Flags de test locaux
- `BREVO_API_KEY` - Envoi des emails (optionnel en dev, codes loggés)
- `S3_*` - Configuration MinIO/R2 pour les images

## Sécurité

Pour la production :
- Changer les mots de passe par défaut
- Utiliser des secrets Docker
- Activer HTTPS sur Nginx
- Restreindre l'accès aux ports internes
