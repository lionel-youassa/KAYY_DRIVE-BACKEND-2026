# Prérequis Matériels et Logiciels - KayyDrive

## Prérequis Logiciels

### 1. Système d'Exploitation

**Recommandé :**
- **Windows 10/11** (64 bits)
- **macOS** (10.15 Catalina ou supérieur)
- **Linux** (Ubuntu 20.04+, Debian 11+, ou équivalent)

**Note :** Le projet est conçu pour fonctionner sur tous les systèmes d'exploitation majeurs grâce à Docker.

---

### 2. Docker et Docker Compose

**Obligatoire pour le déploiement avec Docker (recommandé)**

- **Docker Desktop** ou **Docker Engine**
  - Version minimale : 20.10.0
  - Version recommandée : 24.0.0 ou supérieure
  
- **Docker Compose**
  - Version minimale : 2.0.0
  - Version recommandée : 2.20.0 ou supérieure

**Installation :**

**Windows :**
```bash
# Télécharger Docker Desktop depuis https://www.docker.com/products/docker-desktop
# Installer avec WSL 2 activé
```

**macOS :**
```bash
# Télécharger Docker Desktop depuis https://www.docker.com/products/docker-desktop
# Pour Apple Silicon (M1/M2/M3) : version Apple Silicon
# Pour Intel : version Intel
```

**Linux (Ubuntu/Debian) :**
```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Installer Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

**Vérification :**
```bash
docker --version
docker-compose --version
```

---

### 3. Git

**Obligatoire pour cloner le dépôt**

- **Git**
  - Version minimale : 2.20.0
  - Version recommandée : 2.40.0 ou supérieure

**Installation :**

**Windows :**
```bash
# Télécharger depuis https://git-scm.com/download/win
```

**macOS :**
```bash
brew install git
# ou via Xcode Command Line Tools
xcode-select --install
```

**Linux :**
```bash
sudo apt-get install git  # Ubuntu/Debian
sudo yum install git      # CentOS/RHEL
```

**Vérification :**
```bash
git --version
```

---

### 4. Node.js et npm (Développement local uniquement)

**Requis uniquement pour le développement sans Docker**

- **Node.js**
  - Version minimale : 18.0.0
  - Version recommandée : 20.x LTS ou 22.x LTS
  
- **npm**
  - Version minimale : 9.0.0
  - Version recommandée : 10.0.0 ou supérieure

**Installation :**

**Windows :**
```bash
# Télécharger depuis https://nodejs.org/
# Utiliser nvm-windows pour gérer plusieurs versions
```

**macOS/Linux :**
```bash
# Utiliser nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

**Vérification :**
```bash
node --version
npm --version
```

---

### 5. Python et pip (Développement local uniquement)

**Requis uniquement pour le développement du service IA sans Docker**

- **Python**
  - Version minimale : 3.9
  - Version recommandée : 3.11 ou 3.12
  
- **pip**
  - Version minimale : 21.0
  - Version recommandée : 23.0 ou supérieure

**Installation :**

**Windows :**
```bash
# Télécharger depuis https://www.python.org/downloads/
```

**macOS :**
```bash
brew install python@3.11
```

**Linux :**
```bash
sudo apt-get install python3.11 python3-pip  # Ubuntu/Debian
sudo yum install python3.11 python3-pip      # CentOS/RHEL
```

**Vérification :**
```bash
python --version
pip --version
```

---

### 6. Outils de développement (Optionnel mais recommandé)

**IDE/Éditeur de code :**
- **Visual Studio Code** (recommandé)
  - Extensions recommandées :
    - Docker
    - Prettier
    - ESLint
    - PlantUML (pour visualiser les diagrammes)
    - Prisma
    - Thunder Client (pour tester les API)

- **WebStorm** (optionnel, licence payante)
- **IntelliJ IDEA** (optionnel, licence payante)

**Outils supplémentaires :**
- **Postman** ou **Insomnia** (pour tester les API)
- **DBeaver** ou **pgAdmin** (pour gérer PostgreSQL)
- **RedisInsight** (pour gérer Redis)

---

## Prérequis Matériels

### 1. Configuration Minimale (Développement)

**CPU :**
- Processeur : 2 cœurs minimum
- Recommandé : 4 cœurs ou plus

**RAM :**
- Minimum : 8 Go
- Recommandé : 16 Go
- Optimal : 32 Go (pour le développement avec tous les services)

**Stockage :**
- Espace disque : 20 Go minimum
- Recommandé : 50 Go ou plus (pour les données OSRM, logs, volumes Docker)
- Type : SSD recommandé pour de meilleures performances

**Réseau :**
- Connexion internet stable (pour télécharger les images Docker et les données OSM)

---

### 2. Configuration Recommandée (Production)

**CPU :**
- Processeur : 4 cœurs minimum
- Recommandé : 8 cœurs ou plus

**RAM :**
- Minimum : 16 Go
- Recommandé : 32 Go ou plus
- Optimal : 64 Go (pour haute charge)

**Stockage :**
- Espace disque : 100 Go minimum
- Recommandé : 200 Go ou plus
- Type : SSD obligatoire pour les performances

**Réseau :**
- Bande passante : 100 Mbps minimum
- Recommandé : 1 Gbps ou plus
- Latence : < 50 ms

---

### 3. Configuration par Service (Estimation)

| Service | CPU | RAM | Stockage |
|---------|-----|-----|----------|
| Core API (NestJS) | 1-2 cœurs | 1-2 Go | 5 Go |
| IA Service (FastAPI) | 1-2 cœurs | 2-4 Go | 5 Go |
| PostgreSQL + PostGIS | 1-2 cœurs | 2-4 Go | 20-50 Go |
| Redis | 0.5-1 cœur | 0.5-1 Go | 5 Go |
| Minio | 0.5-1 cœur | 0.5-1 Go | 10-50 Go |
| Nginx | 0.5-1 cœur | 0.5-1 Go | 1 Go |
| OSRM Backend | 2-4 cœurs | 4-8 Go | 10-20 Go |
| **Total (Développement)** | **6-12 cœaux** | **10-20 Go** | **50-100 Go** |
| **Total (Production)** | **8-16 cœaux** | **16-32 Go** | **100-200 Go** |

---

## Prérequis Spécifiques par Scénario

### Scénario 1 : Développement avec Docker (Recommandé)

**Logiciels requis :**
- Docker Desktop 20.10+
- Docker Compose 2.0+
- Git 2.20+

**Matériel recommandé :**
- CPU : 4 cœurs
- RAM : 16 Go
- Stockage : 50 Go SSD

**Commandes de démarrage :**
```bash
git clone <repository-url>
cd kayyDrive
cp .env.example .env
docker-compose up --build
```

---

### Scénario 2 : Développement Local (Sans Docker)

**Logiciels requis :**
- Git 2.20+
- Node.js 18+ et npm 9+
- Python 3.9+ et pip 21+
- PostgreSQL 15+ avec PostGIS 3.3+
- Redis 7+
- Minio (optionnel, peut être remplacé par stockage local)

**Matériel recommandé :**
- CPU : 4 cœurs
- RAM : 16 Go
- Stockage : 50 Go SSD

**Installation des dépendances :**
```bash
# Core API
cd core-api
npm install --legacy-peer-deps
npx prisma generate
npm run start:dev

# IA Service
cd ia-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# PostgreSQL (installation locale ou via Docker)
# Redis (installation locale ou via Docker)
```

---

### Scénario 3 : Production (Cloud)

**Plateformes cloud recommandées :**
- **AWS** : EC2, RDS (PostgreSQL), ElastiCache (Redis), S3 (Minio alternative)
- **Google Cloud** : Compute Engine, Cloud SQL, Memorystore, Cloud Storage
- **Azure** : Virtual Machines, Azure Database for PostgreSQL, Azure Cache for Redis
- **Render** : PaaS recommandé pour le déploiement simplifié

**Configuration minimale serveur :**
- CPU : 4 cœurs
- RAM : 16 Go
- Stockage : 100 Go SSD
- OS : Ubuntu 22.04 LTS ou équivalent

**Logiciels supplémentaires :**
- Docker Engine
- Docker Compose
- Nginx (si pas de load balancer cloud)
- SSL/TLS (Let's Encrypt ou certificat payant)

---

## Prérequis pour les Données OSRM

Le service OSRM nécessite des données de routage OpenStreetMap pour le Cameroun.

**Espace disque supplémentaire :**
- Données brutes OSM : ~500 Mo
- Fichiers OSRM générés : ~2-5 Go
- Total : ~5-10 Go

**Script de génération inclus :**
- Windows : `generate-osrm-data.bat`
- Linux/Mac : `generate-osrm-data.sh`

**Prérequis pour le script :**
- `wget` ou `curl` (pour télécharger les données)
- `osrm-backend` (inclus dans Docker)
- Espace disque temporaire : ~10 Go

---

## Prérequis pour les Tests

**Pour exécuter les tests unitaires :**
- Node.js 18+ et npm 9+
- Jest (installé via npm)

**Pour exécuter les tests d'intégration :**
- Docker et Docker Compose
- Base de données de test PostgreSQL

**Commandes :**
```bash
cd core-api
npm test                    # Tests unitaires
npm run test:e2e           # Tests d'intégration
npm run test:cov           # Tests avec couverture
```

---

## Prérequis pour le Déploiement

**Variables d'environnement requises :**
```env
POSTGRES_USER=kayydrive_user
POSTGRES_PASSWORD=<mot_de_passe_secure>
POSTGRES_DB=kayydrive_db
DATABASE_URL=postgresql://kayydrive_user:<mot_de_passe>@postgres:5432/kayydrive_db
REDIS_URL=redis://redis:6379
OSRM_URL=http://osrm-backend:5000
IA_SERVICE_URL=http://ia-service:8000
JWT_SECRET=<secret_jwt_tres_long>
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=<access_key>
MINIO_SECRET_KEY=<secret_key>
MINIO_BUCKET=kayydrive
```

**Services externes optionnels :**
- **Firebase Cloud Messaging** (pour les notifications push)
- **TomTom API** (optionnel, pour les données de trafic)
- **Google Gemini API** (optionnel, pour les fonctionnalités IA avancées)

---

## Vérification des Prérequis

**Script de vérification (bash) :**
```bash
#!/bin/bash

echo "Vérification des prérequis..."

# Vérifier Docker
if command -v docker &> /dev/null; then
    echo "✓ Docker installé: $(docker --version)"
else
    echo "✗ Docker non installé"
fi

# Vérifier Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "✓ Docker Compose installé: $(docker-compose --version)"
else
    echo "✗ Docker Compose non installé"
fi

# Vérifier Git
if command -v git &> /dev/null; then
    echo "✓ Git installé: $(git --version)"
else
    echo "✗ Git non installé"
fi

# Vérifier Node.js (optionnel)
if command -v node &> /dev/null; then
    echo "✓ Node.js installé: $(node --version)"
else
    echo "⚠ Node.js non installé (optionnel pour Docker)"
fi

# Vérifier Python (optionnel)
if command -v python3 &> /dev/null; then
    echo "✓ Python installé: $(python3 --version)"
else
    echo "⚠ Python non installé (optionnel pour Docker)"
fi

echo "Vérification terminée."
```

---

## Résumé

### Pour le développement avec Docker (Recommandé) :
- **Logiciel** : Docker Desktop, Git
- **Matériel** : 4 cœurs CPU, 16 Go RAM, 50 Go SSD

### Pour le développement local :
- **Logiciel** : Node.js, Python, PostgreSQL, Redis, Git
- **Matériel** : 4 cœurs CPU, 16 Go RAM, 50 Go SSD

### Pour la production :
- **Logiciel** : Docker Engine, Docker Compose, SSL/TLS
- **Matériel** : 8 cœurs CPU, 32 Go RAM, 100 Go SSD
- **Cloud** : AWS/GCP/Azure ou Render

---

## Support

Pour toute question concernant l'installation ou la configuration, consultez :
- **[DOCKER_SETUP.md](DOCKER_SETUP.md)** - Guide détaillé Docker
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Architecture du projet
- **[README.md](README.md)** - Documentation générale
