# Utilise une image Node.js officielle comme base
FROM node:18-alpine AS development

# Crée et définit le répertoire de travail
WORKDIR /app

# Copie package.json et package-lock.json (ou yarn.lock)
COPY package*.json ./

# Installe les dépendances
RUN npm install

# Copie le reste du code source
COPY . .

# Construit l'application NestJS
RUN npm run build

# Image de production
FROM node:18-alpine AS production

WORKDIR /app

# Copie uniquement les dépendances de production
COPY --from=development /app/package*.json ./
RUN npm install --only=production

# Copie le code construit depuis l'étape de développement
COPY --from=development /app/dist ./dist
COPY --from=development /app/.env ./
COPY --from=development /app/src/common/filters ./src/common/filters
COPY --from=development /app/src/common/interceptors ./src/common/interceptors
COPY --from=development /app/src/modules ./src/modules

# Expose le port sur lequel l'application s'exécute
EXPOSE 3000

# Commande pour démarrer l'application
CMD ["node", "dist/main"]
