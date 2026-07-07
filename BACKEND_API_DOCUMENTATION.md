# Backend API Documentation

This document describes the complete API structure for the KayyDrive backend, including all endpoints and their exact response formats.

**Base URL:** `http://localhost:3001`

**Authentication:** JWT token in header `Authorization: Bearer <jwt-token>`

---

## Incidents

### GET /incidents
Retrieve incidents near a location.

**URL:** `http://localhost:3001/incidents`

**Method:** GET

**Protection:** AuthGuard

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query params:**
```
latitude=3.8488
longitude=11.5021
rayon=5000
```

**Response:**
```json
{
  "incidents": [
    {
      "id": "uuid",
      "type": "inondation",
      "description": "Description de l'incident",
      "latitude": 3.8490,
      "longitude": 11.5030,
      "statut": "confirme",
      "nombreConfirmations": 5,
      "confirmePar": ["uuid1", "uuid2"],
      "id_utilisateur_createur": "uuid",
      "dateCreation": "2024-01-01T10:00:00Z",
      "dateExpiration": "2024-01-01T14:00:00Z",
      "imageUrl": "https://minio-url/incidents/image.jpg"
    }
  ]
}
```

### POST /incidents
Create a new incident.

**URL:** `http://localhost:3001/incidents`

**Method:** POST

**Protection:** AuthGuard

**Headers:**
```
Authorization: Bearer <jwt-token>
Content-Type: multipart/form-data
```

**Body (FormData):**
```
image: <file> (optional)
type: "inondation" | "travaux" | "accident"
description: "Description de l'incident"
latitude: 3.8488
longitude: 11.5021
```

**Response:**
```json
{
  "success": true,
  "message": "Incident signalé avec succès",
  "incident": {
    "id": "uuid",
    "type": "inondation",
    "description": "Description de l'incident",
    "latitude": 3.8488,
    "longitude": 11.5021,
    "statut": "non_confirme",
    "nombreConfirmations": 1,
    "confirmePar": ["uuid"],
    "id_utilisateur_createur": "uuid",
    "dateCreation": "2024-01-01T10:00:00Z",
    "dateExpiration": "2024-01-01T14:00:00Z",
    "imageUrl": "https://minio-url/incidents/image.jpg"
  }
}
```

### POST /incidents/:id/confirmer
Confirm an existing incident.

**URL:** `http://localhost:3001/incidents/:id/confirmer`

**Method:** POST

**Protection:** AuthGuard

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Body:**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

**Response:**
```json
{
  "message": "Incident confirmé par la communauté !",
  "incident": {
    "id": "uuid",
    "type": "inondation",
    "description": "Description de l'incident",
    "latitude": 3.8488,
    "longitude": 11.5021,
    "statut": "confirme",
    "nombreConfirmations": 3,
    "confirmePar": ["uuid1", "uuid2", "uuid3"],
    "id_utilisateur_createur": "uuid",
    "dateCreation": "2024-01-01T10:00:00Z",
    "dateExpiration": "2024-01-01T14:00:00Z",
    "imageUrl": "https://minio-url/incidents/image.jpg"
  }
}
```

---

## Geocoding

### GET /geocode/search
Search for places by query string.

**URL:** `http://localhost:3001/geocode/search`

**Method:** GET

**Protection:** AuthGuard

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query params:**
```
query=Akwa
```

**Response:**
```json
{
  "results": [
    {
      "id": "0",
      "name": "Akwa",
      "display_name": "Akwa, Douala, Cameroun",
      "address": "Akwa, Douala, Cameroun",
      "lat": 4.051,
      "lon": 9.767
    }
  ]
}
```

---

## Authentication

### POST /auth/login
Login and get JWT token.

**URL:** `http://localhost:3001/auth/login`

**Method:** POST

**Protection:** Public

**Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "uid": "uuid",
    "email": "user@example.com",
    "nom": "John Doe",
    "prenom": "",
    "role": "user"
  }
}
```

### GET /auth/me
Get user profile.

**URL:** `http://localhost:3001/auth/me`

**Method:** GET

**Protection:** AuthGuard

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "user": {
    "uid": "uuid",
    "email": "user@example.com",
    "nom": "John Doe",
    "prenom": "",
    "role": "user"
  }
}
```

---

## Dashboard

### GET /dashboard/all
Get all dashboard data.

**URL:** `http://localhost:3001/dashboard/all`

**Method:** GET

**Protection:** AdminGuard

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
{
  "overview": {
    "totalUsers": 1500,
    "activeUsers": 850,
    "totalIncidents": 120,
    "totalRoutes": 45
  },
  "incidents": {
    "confirmedIncidents": 85,
    "incidentsByType": {
      "accident": 40,
      "inondation": 25,
      "travaux": 20
    }
  },
  "performance": {
    "averageResponseTime": 150,
    "uptime": 99.5,
    "errorRate": 0.5
  }
}
```
