# KayyDrive Docker Architecture

## Overview

Cette architecture Docker permet de déployer tous les services KayyDrive dans des conteneurs isolés qui communiquent entre eux via un réseau Docker interne.

## Architecture

```
Frontend → Nginx (80) → Core-API (3001)
                        → IA-Service (9500)
                        → OSRM (5000)

Core-API ↔ PostgreSQL (5432)
Core-API ↔ Redis (6379)
Core-API ↔ Minio (9000-9001)
IA-Service ↔ PostgreSQL (5432)
```

## Services

### 1. Core-API (NestJS)
- **Port interne**: 3000
- **Port externe**: 3001
- **Dépendances**: PostgreSQL, Redis, Minio
- **Routes API**: `/api/*`

### 2. IA-Service (FastAPI)
- **Port interne**: 8000
- **Port externe**: 9500
- **Dépendances**: PostgreSQL
- **Routes API**: `/ia/*`

### 3. OSRM Backend
- **Port**: 5000
- **Image**: osrm/osrm-backend:latest
- **Routes API**: `/osrm/*`

### 4. PostgreSQL (PostGIS)
- **Port**: 5432
- **Image**: postgis/postgis:15-3.3
- **Base de données**: kayydrive_db
- **Utilisateur**: kayydrive_user

### 5. Redis
- **Port**: 6379
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

### Prérequis
- Docker Desktop installé
- Docker Compose installé

### Configuration

1. Copier le fichier d'environnement :
```bash
cp .env.example .env
```

2. Configurer les variables dans `.env` si nécessaire

### Démarrer tous les services

```bash
docker-compose up -d
```

### Vérifier l'état des services

```bash
docker-compose ps
```

### Voir les logs

```bash
# Tous les services
docker-compose logs -f

# Service spécifique
docker-compose logs -f core-api
docker-compose logs -f postgres
```

### Arrêter les services

```bash
docker-compose down
```

### Arrêter et supprimer les volumes

```bash
docker-compose down -v
```

## Accès aux API

Une fois les services démarrés, vous pouvez accéder aux API via Nginx :

- **Core API**: http://localhost/api/
- **IA Service**: http://localhost/ia/
- **OSRM**: http://localhost/osrm/
- **Health Check**: http://localhost/health

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
docker-compose logs postgres

# Recréer le volume
docker-compose down -v
docker-compose up -d postgres
```

### Redis ne démarre pas

```bash
# Vérifier les logs
docker-compose logs redis

# Recréer le volume
docker-compose down -v
docker-compose up -d redis
```

### Core-API ne peut pas se connecter à PostgreSQL

Vérifiez que :
1. PostgreSQL est démarré : `docker-compose ps postgres`
2. L'URL de connexion est correcte dans `.env`
3. Les healthchecks sont passés

### Accéder à un conteneur

```bash
# Core-API
docker-compose exec core-api sh

# PostgreSQL
docker-compose exec postgres psql -U kayydrive_user -d kayydrive_db

# Redis
docker-compose exec redis redis-cli
```

## Variables d'environnement

Toutes les variables sont définies dans `.env` :

- `DATABASE_URL` - URL de connexion PostgreSQL
- `REDIS_URL` - URL de connexion Redis
- `OSRM_URL` - URL du service OSRM
- `IA_SERVICE_URL` - URL du service IA
- `FIREBASE_ADMIN_CONFIG` - Configuration Firebase (optionnel)

## Sécurité

Pour la production :
- Changer les mots de passe par défaut
- Utiliser des secrets Docker
- Activer HTTPS sur Nginx
- Restreindre l'accès aux ports internes
