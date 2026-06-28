# Kayy — core-api (NestJS)

Backend principal de Kayy, en NestJS + Firebase Admin SDK (Firestore, Auth, Cloud Messaging) + BullMQ/Redis pour les traitements asynchrones.

## 1. Installation

```bash
pnpm install
```

## 2. Variables d'environnement

Copiez `.env.example` vers `.env` et remplissez :
- `FIREBASE_ADMIN_CONFIG` : JSON du Service Account Firebase (copié tel quel depuis Firebase Console)
- `REDIS_URL` : URL de votre Redis (via `docker-compose`, Upstash, ou local)

## 3. Démarrer en développement

```bash
pnpm run start:dev
```

Le serveur démarre sur `http://localhost:3000`. Toutes les routes (auth, incidents, routes, notifications, safe-drive, trafic, predictions, categories, preferences, users, adresses-favorites) sont actives immédiatement — **pas besoin de lancer un worker séparé** : le traitement BullMQ (module Safe-Drive) tourne dans le même processus Nest grâce à `@nestjs/bullmq`.

## 4. Déployer les règles de sécurité Firestore

```bash
firebase deploy --only firestore:rules
```

## 5. Initialiser les catégories par défaut

```bash
pnpm run seed:categories
```

## 6. Créer le premier compte admin

1. `POST /auth/register` avec votre email/mot de passe
2. Puis :

```bash
pnpm run create:first-admin votre@email.com
```

## 7. Avec Docker

```bash
docker compose up --build
```

(adapté à votre `docker-compose.yml` à la racine du monorepo — assurez-vous qu'il définit un service `redis` et que `REDIS_URL=redis://redis:6379` dans `core-api`)

---

## Architecture des modules

Chaque domaine métier suit la même structure NestJS :
```
src/<module>/
  ├── <module>.module.ts       # déclare controller + service + imports
  ├── <module>.controller.ts   # routes HTTP
  ├── <module>.service.ts      # logique métier + accès Firestore
  └── dto/                     # validation des entrées (class-validator)
```

- **`firebase/`** : module global, expose `db`, `auth`, `messaging` (Firebase Admin SDK) injectables partout
- **`auth/`** : inscription, profils, rôles, et les **Guards** (`AuthGuard`, `AdminGuard`) utilisés par tous les autres modules pour protéger leurs routes

## Récapitulatif des routes

### Auth (Tâche 5.1)
| Méthode | Route | Protection |
|---|---|---|
| POST | `/auth/register` | Publique |
| GET | `/auth/me` | AuthGuard |
| POST | `/auth/promote` | AuthGuard + AdminGuard |

### Hydro-Guard & Incidents (Tâche 8.0)
| Méthode | Route | Protection |
|---|---|---|
| GET | `/incidents?latitude=&longitude=&rayon=` | AuthGuard |
| POST | `/incidents` | AuthGuard |
| POST | `/incidents/:id/confirmer` | AuthGuard |

### Routes Locales (Tâche 9.1)
| Méthode | Route | Protection |
|---|---|---|
| POST | `/routes` | AuthGuard |
| POST | `/routes/:id/voter` | AuthGuard |
| GET | `/routes/suggestions?departLat=&departLng=&arriveeLat=&arriveeLng=` | AuthGuard |

### Safe-Drive (Tâche 10.1)
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
| GET | `/categories` | AuthGuard |
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

---

## Tester une route protégée

```
Authorization: Bearer <idToken Firebase>
```

Le token s'obtient côté client via le SDK Firebase Auth (`getIdToken()`), jamais généré côté backend.
