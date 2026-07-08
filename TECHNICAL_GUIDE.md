# KayyDrive Monorepo — Professional Technical Documentation

Welcome to the engineering documentation for the **KayyDrive Monorepo**. This document details the architectural specifications, algorithms, database logic, and setup guidelines for the entire backend ecosystem.

---

## 🏗️ Architecture & Component Ecosystem

The system comprises five core services orchestrated via **Docker Compose**:

1. **Core API (NestJS)**: Main gateway handling authentication, user profiles, incident reports, reward points, and route calculation orchestration. Runs on Node.js v22.
2. **IA Service (FastAPI)**: Responsible for AI-driven traffic prediction, congestion hotspots, and chatbot interface operations.
3. **OSRM Backend (C++)**: High-performance routing engine serving path finding operations snap-to-road, loaded with customized Cameroon OpenStreetMap datasets.
4. **PostgreSQL & PostGIS**: Relational geolocated storage using Prisma ORM. No Firebase is utilized.
5. **Redis & BullMQ**: Cache management layer and async queue processing engine (used for Safe-Drive telemetry analysis).
6. **Minio (S3-Compatible)**: Handles object storage for images of incidents, rewards, and B2B advertisements.

```
                  ┌──────────────────────┐
                  │   Flutter Frontend   │
                  └──────────┬───────────┘
                             │ HTTP / WebSockets
                             ▼
                    ┌──────────────────┐
                    │ Nginx Proxy (80) │
                    └────────┬─────────┘
                             │
            ┌────────────────┴────────────────┐
     /api/* │                          /ia/*  │
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │ Core API (3001) │               │   IA Service    │
   │    (NestJS)     │               │    (FastAPI)    │
   └────────┬────────┘               └────────┬────────┘
            ├─────────────────────────────────┤
            ▼                                 ▼
   ┌─────────────────┐               ┌─────────────────┐
   │ PostgreSQL + GIS│               │  OSRM (Port 5000)│
   └─────────────────┘               └─────────────────┘
```

---

## 🧭 Navigation & Rerouting Architecture

The most critical logic is encapsulated within the `NavigationService` of `core-api`.

### 1. Smart Route Engine (`getSmartRoute`)
The routing engine accepts a starting GPS point, a destination, a navigation profile (`vehicle` or `pedestrian`), and a routing preference (`confort` or `rapide`).

* **Pedestrian Mode**: Requests a standard walking path from OSRM (1.38 m/s speed fallback) and displays a simple green line on the map.
* **Vehicle Mode**: Performs multi-segment traffic querying, dynamically color-coding the route.
* **Confort Mode**: Actively detects road obstacles and incidents (floods, construction, severe potholes) and forces detours.
* **Rapide Mode**: Prioritizes travel duration by checking traffic levels while avoiding only absolute blockages (floods).

---

### 2. Smart Bypass Detour Algorithm (OSRM Nearest + Waypoints)

When the routing mode is set to `confort` and the primary path intersects an active incident (flood, construction, or severely degraded road):

```
                       [Incident (X)]
                              │
  Start (A) ───[Segment 1]───[Intersection]───[Segment 2]───► End (B)
                  │                                ▲
                  └─────────► Detour (W) ──────────┘
```

1. **Incident Attribution**: The path geometry is compared against active community incident coordinates. If any coordinate point on the path gets within **50 meters** of the incident, it is marked as intersected.
2. **Nearest Road Waypoint Querying**: The service triggers a query to OSRM `/nearest` at the incident coordinates with `number=15` to identify all adjacent street segments.
3. **Candidate Filtering**:
   * To prevent selecting the same blocked segment, candidates are filtered to be at a safe distance from the incident: **`distance >= 55m`** (tuned for short-distance routes) and **`distance <= 350m`** (prevents generating excessively long detours).
4. **Multipoint Routing Simulation**:
   * For the top 3 closest candidates, the system requests a 3-waypoint route: `Start (A) ──► Candidate Waypoint (W) ──► End (B)`.
5. **Short-Distance Rerouting Guard**:
   * In short-distance configurations (e.g. 100m routes), the start and destination points themselves are physically located within 50m of the obstacle.
   * To prevent false positives, coordinates located within **30 meters** of the start and destination points are **completely ignored** during incident evaluation.
6. **Selection Criteria**:
   * The candidate route with the highest `comfortScore` (least number of incidents on path) is chosen.
   * If multiple detours have the same comfort score, the system selects the one with the shortest duration, provided it does not exceed `originalDuration * 2.5 + 300 seconds`.

---

### 3. Traffic Speed Interpolation System
Real-time traffic speeds are computed using a **3-tier hybrid pipeline**:
1. **Waze LiveMap API**: Real-time traffic proxy querying `routing-livemap-row.waze.com` for local speeds.
2. **Prisma DB Historical Cache**: Local table `ReleveTrafic` matching geohashes or coordinate boxes.
3. **Static Fallback**: Defaults to `25 km/h` (fluid/moderate) in the absence of telemetry.

---

## 🧪 Testing Architecture

Unit tests are written using **Jest** and **ts-jest**. Services are fully mocked (Prisma client, JwtService, GeocodingService) to enable isolated local verification.

### Run Unit Tests
To run all tests (including controllers and services):
```bash
cd core-api
npm run test
```

*All 30 unit tests validating registration, logins, token generation, profile changes, incident creations, proximity confirmations, and resolutions are fully integrated and passing.*

---

## 🚀 Step-by-Step Setup Guide

Follow this guide to spin up the monorepo from scratch on your development machine.

### Step 1: Environment Configuration
Create a `.env` file at the root of the project:
```env
POSTGRES_USER=kayydrive_user
POSTGRES_PASSWORD=kayydrive_secure_password_2026
POSTGRES_DB=kayydrive_db
DATABASE_URL=postgresql://kayydrive_user:kayydrive_secure_password_2026@postgres:5432/kayydrive_db
REDIS_URL=redis://redis:6379
OSRM_URL=http://osrm-backend:5000
IA_SERVICE_URL=http://ia-service:8000
JWT_SECRET=your_jwt_secret_key_change_in_production
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=admin123
```

### Step 2: Download & Process Cameroon OSM Map Data
OSRM requires pre-compiled map grids to compute routes. To download Cameroon's OSM grid and compile it:

* **On Windows**:
  ```powershell
  .\generate-osrm-data.bat
  ```
* **On Linux / macOS**:
  ```bash
  chmod +x generate-osrm-data.sh
  ./generate-osrm-data.sh
  ```

*This process downloads the dataset from Geofabrik, extracts it, and compiles the routing profile.*

### Step 3: Run the Monorepo
Boot up the Docker stack:
```bash
docker-compose up -d --build
```

On first run, the database is automatically provisioned with the schema via Prisma, and default values (categories, admin user) are seeded.

---

## 📂 Backend Structure Reference

* `/core-api/src/modules/navigation`: Routing engine, OSRM request builder, detours, and traffic segment interpolation.
* `/core-api/src/incidents`: Incident creation, validation radius, and database persistency.
* `/core-api/src/auth`: JWT strategies, register/login handlers, and roles management.
* `/core-api/src/prisma`: Prisma schema defining tables for users, incidents, traffic records, and rewards.
* `/ia-service`: Python service for neural network traffic forecasting.
