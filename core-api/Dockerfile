# Image de base pour le développement
FROM node:18-alpine AS development

WORKDIR /app

# On copie les fichiers de config et on installe tout
COPY package*.json ./
RUN npm install

# On copie le reste du code
COPY . .

# On expose le port
EXPOSE 3000

# Commande de démarrage par défaut (NestJS en mode watch)
CMD ["npm", "run", "start:dev"]


# Image de production (optionnel pour l'instant)
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=development /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
