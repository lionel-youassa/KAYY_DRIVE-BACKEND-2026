# Kayy — core-api (NestJS)

Backend principal de Kayy, en NestJS + Prisma ORM (PostgreSQL) + Minio (stockage images) + BullMQ/Redis pour les traitements asynchrones.

## 1. Installation

```bash
npm install
```

## 2. Variables d'environnement

Copiez `.env.example` vers `.env` et remplissez :
- `DATABASE_URL` : URL de connexion PostgreSQL
- `REDIS_URL` : URL de votre Redis (via `docker-compose`, Upstash, ou local)
- `MINIO_ENDPOINT` : Endpoint Minio (minio pour Docker)
- `MINIO_PORT` : Port Minio (9000)
- `MINIO_ACCESS_KEY` : Clé d'accès Minio
- `MINIO_SECRET_KEY` : Secret Minio
- `MINIO_BUCKET` : Nom du bucket Minio
- `JWT_SECRET` : Secret pour les tokens JWT
- `FIREBASE_ADMIN_CONFIG` : JSON du Service Account Firebase (optionnel)

## 3. Démarrer en développement

```bash
npm run start:dev
```

Le serveur démarre sur `http://localhost:3000`. Toutes les routes sont actives immédiatement — **pas besoin de lancer un worker séparé** : le traitement BullMQ (module Safe-Drive) tourne dans le même processus Nest grâce à `@nestjs/bullmq`.

## 4. Base de données

### Initialisation automatique (Docker)
Au premier démarrage du conteneur Docker, le script `init-db.ts` exécute automatiquement :
- `prisma db push` pour créer les tables dans PostgreSQL
- Le seed pour créer l'admin par défaut et les catégories (si aucun admin n'existe)

### Manuellement
```bash
# Créer les tables
npx prisma db push

# Lancer le seed
npm run seed
```

### Générer le client Prisma
```bash
npx prisma generate
```

## 5. Avec Docker

```bash
docker compose up --build
```

Le service est accessible sur `http://localhost:3001` (port mappé dans docker-compose.yml).

## 6. Tests

L'architecture de tests est configurée avec Jest et ts-jest.

```bash
# Lancer tous les tests
npm test

# Lancer les tests en mode watch
npm run test:watch

# Générer le rapport de couverture
npm run test:cov
```

**Structure des tests :**
- `test/setup.ts` : Configuration globale et cleanup de la base de données
- `test/helpers/test-helpers.ts` : Helpers pour créer des données de test
- `test/mocks/prisma.mock.ts` : Mocks du client Prisma
- `src/**/*.spec.ts` : Tests unitaires par module

## 7. Documentation API

La documentation Swagger est accessible sur :
```
http://localhost:3000/api/docs
```

## 8. Stockage d'images (Minio)

Le projet utilise Minio pour le stockage des images (incidents, publicités, récompenses).

**Endpoint d'upload :**
```
POST /storage/upload
Content-Type: multipart/form-data
```

**Exemple :**
```bash
curl -X POST http://localhost:3000/storage/upload \
  -F "file=@/path/to/image.jpg" \
  -F "folder=incidents"
```

**Restrictions :**
- Types autorisés : JPEG, PNG, WebP, GIF
- Taille maximale : 5MB

---

## Architecture des modules

Chaque domaine métier suit la même structure NestJS :
```
src/<module>/
  ├── <module>.module.ts       # déclare controller + service + imports
  ├── <module>.controller.ts   # routes HTTP
  ├── <module>.service.ts      # logique métier + accès Prisma
  └── dto/                     # validation des entrées (class-validator)
```

- **`prisma/`** : Schéma de base de données et client Prisma
- **`storage/`** : Service de stockage d'images avec Minio
- **`auth/`** : inscription, profils, rôles, et les **Guards** (`AuthGuard`, `AdminGuard`)
- **`firebase/`** : Module optionnel pour Firebase (Auth, Cloud Messaging)

## Récapitulatif des routes

### Auth
| Méthode | Route | Protection |
|---|---|---|
| POST | `/auth/register` | Publique |
| GET | `/auth/me` | AuthGuard |
| POST | `/auth/promote` | AuthGuard + AdminGuard |

### Incidents
| Méthode | Route | Protection |
|---|---|---|
| GET | `/incidents?latitude=&longitude=&rayon=` | AuthGuard |
| POST | `/incidents` | AuthGuard (avec image optionnelle) |
| POST | `/incidents/:id/confirmer` | AuthGuard |

### Routes Locales
| Méthode | Route | Protection |
|---|---|---|
| POST | `/routes` | AuthGuard |
| POST | `/routes/:id/voter` | AuthGuard |
| GET | `/routes/suggestions?departLat=&departLng=&arriveeLat=&arriveeLng=` | AuthGuard |

### Safe-Drive
| Méthode | Route | Protection |
|---|---|---|
| POST | `/safe-drive/secousse` | AuthGuard |

### Trafic & Prédictions
| Méthode | Route | Protection |
|---|---|---|
| GET | `/trafic?latitude=&longitude=&rayon=` | AuthGuard |
| POST | `/trafic` | AuthGuard |
| GET | `/predictions?latitude=&longitude=&horodatage=` | AuthGuard |
| POST | `/predictions/itineraire` | AuthGuard |

### Notifications
| Méthode | Route | Protection |
|---|---|---|
| GET | `/notifications` | AuthGuard |
| POST | `/notifications/token` | AuthGuard |
| PATCH | `/notifications/:id/lue` | AuthGuard |

### Catégories & Préférences
| Méthode | Route | Protection |
|---|---|---|
| GET | `/categories` | Publique |
| POST | `/categories` | AuthGuard + AdminGuard |
| GET | `/preferences` | AuthGuard |
| PATCH | `/preferences` | AuthGuard |

### Utilisateurs & Adresses favorites
| Méthode | Route | Protection |
|---|---|---|
| POST | `/users/position` | AuthGuard |
| DELETE | `/users/position` | AuthGuard |
| GET | `/adresses-favorites` | AuthGuard |
| POST | `/adresses-favorites` | AuthGuard |
| DELETE | `/adresses-favorites/:id` | AuthGuard |

### Publicités (Admin)
| Méthode | Route | Protection |
|---|---|---|
| GET | `/ads` | AuthGuard |
| POST | `/ads` | AuthGuard + AdminGuard (avec image optionnelle) |
| DELETE | `/ads/:id` | AuthGuard + AdminGuard |

### Récompenses (Admin)
| Méthode | Route | Protection |
|---|---|---|
| GET | `/rewards` | AuthGuard |
| POST | `/rewards` | AuthGuard + AdminGuard (avec image optionnelle) |
| DELETE | `/rewards/:id` | AuthGuard + AdminGuard |

### Dashboard (Admin)
| Méthode | Route | Protection |
|---|---|---|
| GET | `/dashboard/overview` | AuthGuard + AdminGuard |
| GET | `/dashboard/shortcuts` | AuthGuard + AdminGuard |
| GET | `/dashboard/incidents` | AuthGuard + AdminGuard |
| GET | `/dashboard/safe-drive` | AuthGuard + AdminGuard |
| GET | `/dashboard/engagement` | AuthGuard + AdminGuard |
| GET | `/dashboard/performance` | AuthGuard + AdminGuard |
| GET | `/dashboard/all` | AuthGuard + AdminGuard |

### Offline
| Méthode | Route | Protection |
|---|---|---|
| GET | `/offline/zones` | AuthGuard |
| GET | `/offline/zones/:zoneId/metadata` | AuthGuard |
| GET | `/offline/zones/:zoneId/download` | AuthGuard |
| POST | `/offline/zones/:zoneId/generate` | AuthGuard + AdminGuard |

### Navigation
| Méthode | Route | Protection |
|---|---|---|
| GET | `/route/basic?startLat=&startLng=&endLat=&endLng=` | Publique |
| GET | `/route/smart?startLat=&startLng=&endLat=&endLng=` | Publique |
| POST | `/route/reroute` | Publique |
| POST | `/route/snap-to-road` | Publique |

### Storage
| Méthode | Route | Protection |
|---|---|---|
| POST | `/storage/upload` | Publique |

---

## Tester une route protégée

```
Authorization: Bearer <idToken Firebase>
```

Le token s'obtient côté client via le SDK Firebase Auth (`getIdToken()`), jamais généré côté backend.

