# --- Étape 1 : développement ---
FROM node:22-alpine AS development

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

# Install OpenSSL and curl for Prisma compatibility and health checks
RUN apk add --no-cache openssl curl

EXPOSE 3000

CMD ["sh", "-c", "npm install --legacy-peer-deps && npx prisma generate && npm run start:dev"]

# --- Étape 2 : build ---
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npx prisma generate
RUN npm run build

# --- Étape 3 : production ---
FROM node:22-alpine AS production

WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl curl

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
