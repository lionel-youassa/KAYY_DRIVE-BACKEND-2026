# KayyDrive Monorepo

Bienvenue dans le monorepo de KayyDrive, une application de navigation routière intelligente conçue pour les réalités africaines.

Ce dépôt contient les différents services qui composent l'architecture backend de KayyDrive.

## Structure du Projet

- `core-api/`: Le service principal (NestJS) géré par Lionel, Cindy et Atouga. Il orchestre la navigation, gère les requêtes API et interagit avec les autres microservices.
- `ia-service/`: Le microservice d'Intelligence Artificielle (FastAPI/Python) géré par Danielle. Il est responsable des prédictions de trafic, de l'analyse des données et d'autres logiques IA.
- `docker-compose.yml`: Fichier d'orchestration Docker pour démarrer et gérer tous les services.

## Démarrage Rapide

1.  **Cloner le dépôt :**
    \`\`\`bash
    git clone [URL_DU_DEPOT]
    cd kayyDrive
    \`\`\`

2.  **Configuration des variables d'environnement :**
    Créez un fichier `.env` dans le dossier \`core-api/\` et \`ia-service/\` (si nécessaire) en vous basant sur les exemples fournis ou les besoins de chaque service.

    Exemple pour \`core-api/.env\`:
    \`\`\`
    PORT=3000
    NODE_ENV=development
    OSRM_URL=http://osrm-backend:5000 # Exemple, à adapter
    \`\`\`

3.  **Démarrer les services avec Docker Compose :**
    \`\`\`bash
    docker-compose up --build
    \`\`\`
    Ceci construira les images Docker et démarrera tous les services définis dans \`docker-compose.yml\`.

4.  **Accéder à l'API :**
    -   **Core API (NestJS):** \`http://localhost:3000\`
    -   **Documentation Swagger:** \`http://localhost:3000/api/docs\`
    -   **IA Service (FastAPI):** \`http://localhost:8000\` (si démarré)

## Développement

Chaque service a son propre \`package.json\` (pour Node.js) ou \`requirements.txt\` (pour Python) et peut être développé indépendamment.

### Core API (NestJS)

Pour développer l'API NestJS sans Docker :

1.  Naviguez dans le dossier \`core-api/\`:
    \`\`\`bash
    cd core-api
    \`\`\`
2.  Installez les dépendances :
    \`\`\`bash
    npm install
    \`\`\`
3.  Démarrez l'application en mode développement :
    \`\`\`bash
    npm run start:dev
    \`\`\`

### IA Service (FastAPI)

Pour développer le service IA (voir la documentation spécifique de Danielle).

## Contribution

Veuillez suivre les directives de contribution de l'équipe.
