# Guide API Frontend - Documentation Complète

Ce document décrit tous les endpoints de l'API KayyDrive pour l'intégration frontend.

**Base URL :** `http://localhost:3001`

**Authentication :** La plupart des routes nécessitent un token Firebase dans le header `Authorization: Bearer <token>`

---

## Table des Matières

1. [Authentification](#authentification)
2. [Navigation](#navigation)
3. [Incidents (Hydro-Guard)](#incidents-hydro-guard)
4. [Routes Locales (Raccourcis)](#routes-locales-raccourcis)
5. [Safe-Drive](#safe-drive)
6. [Trafic](#trafic)
7. [Prédictions](#prédictions)
8. [Notifications](#notifications)
9. [Catégories](#catégories)
10. [Préférences](#préférences)
11. [Utilisateurs](#utilisateurs)
12. [Adresses Favorites](#adresses-favorites)
13. [Publicités (Ads)](#publicités-ads)
14. [Récompenses (Rewards)](#récompenses-rewards)
15. [Dashboard (Admin)](#dashboard-admin)
16. [Offline](#offline)
17. [Storage](#storage)

---

## Authentification

### POST /auth/register
Créer un nouveau compte utilisateur.

**URL :** `http://localhost:3001/auth/register`

**Méthode :** POST

**Protection :** Publique

**Body :**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "displayName": "John Doe"
}
```

**Réponse :**
```json
{
  "success": true,
  "user": {
    "uid": "user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "user"
  }
}
```

---

### POST /auth/login
Connexion d'un utilisateur.

**URL :** `http://localhost:3001/auth/login`

**Méthode :** POST

**Protection :** Publique

**Body :**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Réponse :**
```json
{
  "success": true,
  "token": "firebase-token",
  "user": {
    "uid": "user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe"
  }
}
```

---

### GET /auth/me
Récupérer le profil de l'utilisateur connecté.

**URL :** `http://localhost:3001/auth/me`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "user": {
    "uid": "user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe",
    "role": "user"
  }
}
```

---

### POST /auth/promote
Changer le rôle d'un utilisateur (Admin uniquement).

**URL :** `http://localhost:3001/auth/promote`

**Méthode :** POST

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Body :**
```json
{
  "uid": "user-uuid",
  "role": "admin"
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Rôle mis à jour : admin"
}
```

---

## Navigation

### GET /route/basic
Calcul d'un itinéraire basique via OSRM.

**URL :** `http://localhost:3001/route/basic`

**Méthode :** GET

**Protection :** Publique

**Query params :**
```
startLat=4.051
startLng=9.767
endLat=3.848
endLng=11.502
```

**Réponse :**
```json
{
  "duration": 2100,
  "distance": 15000,
  "geometry": {
    "type": "LineString",
    "coordinates": [[11.5021, 3.8488], [11.5100, 3.8500]]
  },
  "instructions": [
    {
      "text": "Départ de Avenue Kennedy",
      "distance": 0,
      "duration": 0,
      "location": [11.5021, 3.8488],
      "type": "depart",
      "streetName": "Avenue Kennedy",
      "instructionIndex": 0
    }
  ],
  "suggestedLocalRoutes": []
}
```

---

### GET /route/smart
Calcul d'un itinéraire intelligent avec trafic, incidents et routes locales.

**URL :** `http://localhost:3001/route/smart`

**Méthode :** GET

**Protection :** Publique

**Query params :**
```
startLat=4.051
startLng=9.767
endLat=3.848
endLng=11.502
```

**Réponse :**
```json
{
  "duration": 2100,
  "distance": 15000,
  "geometry": {
    "type": "LineString",
    "coordinates": [[11.5021, 3.8488], [11.5100, 3.8500]]
  },
  "instructions": [
    {
      "text": "Dans 100 m, tournez à droite vers Boulevard de la Liberté",
      "distance": 100,
      "duration": 15,
      "location": [11.5030, 3.8490],
      "type": "turn",
      "streetName": "Avenue Kennedy",
      "instructionIndex": 1
    }
  ],
  "suggestedLocalRoutes": [],
  "incidentsOnRoute": [
    {
      "type": "travaux",
      "description": "Travaux sur N3",
      "latitude": 3.849,
      "longitude": 11.503,
      "statut": "confirme"
    }
  ],
  "trafficPrediction": {
    "niveau_trafic": "moyen",
    "temps_estime_minutes": 35
  },
  "smartFeatures": {
    "trafficEnabled": true,
    "localRoutesEnabled": true,
    "incidentsEnabled": true
  }
}
```

---

### POST /route/reroute
Recalcule automatique l'itinéraire si l'utilisateur s'éloigne du tracé (plus de 50m).

**URL :** `http://localhost:3001/route/reroute`

**Méthode :** POST

**Protection :** Publique

**Body :**
```json
{
  "currentLat": 3.8488,
  "currentLng": 11.5021,
  "endLat": 3.8500,
  "endLng": 11.5100
}
```

**Réponse :**
```json
{
  "duration": 2100,
  "distance": 15000,
  "geometry": { "type": "LineString", "coordinates": [...] },
  "instructions": [...],
  "suggestedLocalRoutes": [...],
  "incidentsOnRoute": [...],
  "trafficPrediction": {...}
}
```

---

### POST /route/snap-to-road
Recale les coordonnées GPS sur la route la plus proche.

**URL :** `http://localhost:3001/route/snap-to-road`

**Méthode :** POST

**Protection :** Publique

**Body :**
```json
{
  "coordinates": [
    [11.5021, 3.8488],
    [11.5030, 3.8490],
    [11.5100, 3.8500]
  ]
}
```

**Réponse :**
```json
{
  "snappedCoordinates": [[11.5022, 3.8489], [11.5031, 3.8491], [11.5101, 3.8501]],
  "confidence": 0.95,
  "distance": 15000,
  "duration": 2100
}
```

---

## Incidents (Hydro-Guard)

### GET /incidents
Récupérer les incidents proches d'une position.

**URL :** `http://localhost:3001/incidents`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Query params :**
```
latitude=3.8488
longitude=11.5021
rayon=5000
```

**Réponse :**
```json
{
  "incidents": [
    {
      "id": "incident-uuid",
      "type": "inondation",
      "description": "Route inondée",
      "latitude": 3.8490,
      "longitude": 11.5030,
      "statut": "confirme",
      "nombreValidations": 5,
      "imageUrl": "https://minio-url/image.jpg"
    }
  ]
}
```

---

### POST /incidents
Signaler un nouvel incident.

**URL :** `http://localhost:3001/incidents`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
Content-Type: multipart/form-data
```

**Body (FormData) :**
```
image: <file> (optionnel)
type: "inondation" | "travaux" | "accident"
description: "Description de l'incident"
latitude: 3.8488
longitude: 11.5021
```

**Réponse :**
```json
{
  "success": true,
  "incident": {
    "id": "incident-uuid",
    "type": "inondation",
    "description": "Route inondée",
    "latitude": 3.8488,
    "longitude": 11.5021,
    "imageUrl": "https://minio-url/image.jpg"
  }
}
```

---

### POST /incidents/:id/confirmer
Confirmer un incident existant.

**URL :** `http://localhost:3001/incidents/:id/confirmer`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Incident confirmé",
  "nombreValidations": 6
}
```

---

## Routes Locales (Raccourcis)

### POST /routes
Créer un nouveau raccourci communautaire.

**URL :** `http://localhost:3001/routes`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "nom": "Raccourci Akwa",
  "description": "Évite les bouchons",
  "pointDepart": {
    "latitude": 3.8488,
    "longitude": 11.5021
  },
  "pointArrivee": {
    "latitude": 3.8500,
    "longitude": 11.5100
  },
  "trace": {
    "type": "LineString",
    "coordinates": [[11.5021, 3.8488], [11.5100, 3.8500]]
  }
}
```

**Réponse :**
```json
{
  "success": true,
  "raccourci": {
    "id": "route-uuid",
    "nom": "Raccourci Akwa",
    "description": "Évite les bouchons",
    "votesPositifs": 0,
    "votesNegatifs": 0
  }
}
```

---

### POST /routes/:id/voter
Voter pour un raccourci.

**URL :** `http://localhost:3001/routes/:id/voter`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "vote": "positif"
}
```

**Réponse :**
```json
{
  "success": true,
  "votesPositifs": 1,
  "votesNegatifs": 0
}
```

---

### GET /routes/suggestions
Obtenir des suggestions de raccourcis pour un trajet.

**URL :** `http://localhost:3001/routes/suggestions`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Query params :**
```
departLat=3.8488
departLng=11.5021
arriveeLat=3.8500
arriveeLng=11.5100
```

**Réponse :**
```json
{
  "raccourcis": [
    {
      "id": "route-uuid",
      "nom": "Raccourci Akwa",
      "description": "Évite les bouchons",
      "votesPositifs": 15,
      "votesNegatifs": 2
    }
  ]
}
```

---

## Safe-Drive

### POST /safe-drive/secousse
Enregistrer une secousse (détection de qualité de route).

**URL :** `http://localhost:3001/safe-drive/secousse`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021,
  "intensite": 7.5
}
```

**Réponse :**
```json
{
  "success": true,
  "message": "Donnée reçue et mise en file"
}
```

---

## Trafic

### GET /trafic
Récupérer le trafic actuel dans une zone.

**URL :** `http://localhost:3001/trafic`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Query params :**
```
latitude=3.8488
longitude=11.5021
rayon=5000
```

**Réponse :**
```json
{
  "trafic": [
    {
      "latitude": 3.8490,
      "longitude": 11.5030,
      "niveau": "eleve",
      "vitesseMoyenne": 15,
      "horodatage": "2026-07-02T10:00:00Z"
    }
  ]
}
```

---

### POST /trafic
Enregistrer un relevé de trafic.

**URL :** `http://localhost:3001/trafic`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021,
  "niveau": "eleve",
  "vitesseMoyenne": 15
}
```

**Réponse :**
```json
{
  "success": true,
  "relevé": {
    "id": "trafic-uuid",
    "latitude": 3.8488,
    "longitude": 11.5021,
    "niveau": "eleve"
  }
}
```

---

## Prédictions

### GET /predictions
Prédire le trafic à un point donné à une date future.

**URL :** `http://localhost:3001/predictions`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Query params :**
```
latitude=3.8488
longitude=11.5021
horodatage=2026-07-02T14:00:00Z
```

**Réponse :**
```json
{
  "prediction": {
    "niveau_trafic": "moyen",
    "temps_estime_minutes": 25,
    "confiance": 0.85
  }
}
```

---

### POST /predictions/itineraire
Prédire le trafic sur un itinéraire complet.

**URL :** `http://localhost:3001/predictions/itineraire`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "points": [
    { "latitude": 3.8488, "longitude": 11.5021 },
    { "latitude": 3.8500, "longitude": 11.5100 }
  ],
  "horodatage": "2026-07-02T14:00:00Z"
}
```

**Réponse :**
```json
{
  "predictions": [
    {
      "latitude": 3.8488,
      "longitude": 11.5021,
      "niveau_trafic": "moyen",
      "temps_estime_minutes": 25
    }
  ]
}
```

---

## Notifications

### GET /notifications
Récupérer les notifications de l'utilisateur.

**URL :** `http://localhost:3001/notifications`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "notifications": [
    {
      "id": "notif-uuid",
      "titre": "Incident proche",
      "corps": "Inondation signalée près de vous",
      "lue": false,
      "horodatage": "2026-07-02T10:00:00Z"
    }
  ]
}
```

---

### POST /notifications/token
Enregistrer un token FCM pour les push notifications.

**URL :** `http://localhost:3001/notifications/token`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "token": "fcm_token_here"
}
```

**Réponse :**
```json
{
  "success": true
}
```

---

### PATCH /notifications/:id/lue
Marquer une notification comme lue.

**URL :** `http://localhost:3001/notifications/:id/lue`

**Méthode :** PATCH

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "success": true
}
```

---

## Catégories

### GET /categories
Récupérer toutes les catégories.

**URL :** `http://localhost:3001/categories`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "categories": [
    {
      "id": "cat-uuid",
      "nom": "Transport",
      "icone": "🚌",
      "couleur": "#3B82F6",
      "ordre": 1
    }
  ]
}
```

---

### POST /categories
Créer une nouvelle catégorie (Admin uniquement).

**URL :** `http://localhost:3001/categories`

**Méthode :** POST

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Body :**
```json
{
  "nom": "Transport",
  "icone": "🚌",
  "couleur": "#3B82F6",
  "ordre": 1
}
```

**Réponse :**
```json
{
  "success": true,
  "categorie": {
    "id": "cat-uuid",
    "nom": "Transport",
    "icone": "🚌",
    "couleur": "#3B82F6",
    "ordre": 1
  }
}
```

---

## Préférences

### GET /preferences
Récupérer les préférences de l'utilisateur.

**URL :** `http://localhost:3001/preferences`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "preferences": {
    "theme": "dark",
    "langue": "fr",
    "notificationsEnabled": true,
    "unitesDistance": "km"
  }
}
```

---

### PATCH /preferences
Mettre à jour les préférences de l'utilisateur.

**URL :** `http://localhost:3001/preferences`

**Méthode :** PATCH

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "theme": "dark",
  "langue": "fr",
  "notificationsEnabled": true,
  "unitesDistance": "km"
}
```

**Réponse :**
```json
{
  "success": true,
  "preferences": {
    "theme": "dark",
    "langue": "fr",
    "notificationsEnabled": true,
    "unitesDistance": "km"
  }
}
```

---

## Utilisateurs

### POST /users/position
Mettre à jour la position de l'utilisateur.

**URL :** `http://localhost:3001/users/position`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

**Réponse :**
```json
{
  "success": true
}
```

---

### DELETE /users/position
Supprimer la position de l'utilisateur.

**URL :** `http://localhost:3001/users/position`

**Méthode :** DELETE

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "success": true
}
```

---

## Adresses Favorites

### GET /adresses-favorites
Récupérer les adresses favorites de l'utilisateur.

**URL :** `http://localhost:3001/adresses-favorites`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "adresses": [
    {
      "id": "addr-uuid",
      "nom": "Maison",
      "adresse": "123 Rue Principale",
      "latitude": 3.8488,
      "longitude": 11.5021
    }
  ]
}
```

---

### POST /adresses-favorites
Ajouter une adresse favorite.

**URL :** `http://localhost:3001/adresses-favorites`

**Méthode :** POST

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Body :**
```json
{
  "nom": "Maison",
  "adresse": "123 Rue Principale",
  "latitude": 3.8488,
  "longitude": 11.5021
}
```

**Réponse :**
```json
{
  "success": true,
  "id": "addr-uuid"
}
```

---

### DELETE /adresses-favorites/:id
Supprimer une adresse favorite.

**URL :** `http://localhost:3001/adresses-favorites/:id`

**Méthode :** DELETE

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "success": true
}
```

---

## Publicités (Ads)

### GET /ads
Récupérer toutes les publicités actives.

**URL :** `http://localhost:3001/ads`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
[
  {
    "id": "ad-uuid",
    "titre": "Promotion KayyDrive",
    "description": "Offre spéciale",
    "type": "banner",
    "imageUrl": "https://minio-url/ad.jpg",
    "dateDebut": "2026-07-01T00:00:00Z",
    "dateFin": "2026-07-31T23:59:59Z",
    "actif": true
  }
]
```

---

### POST /ads
Créer une publicité (Admin uniquement).

**URL :** `http://localhost:3001/ads`

**Méthode :** POST

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**Body (FormData) :**
```
image: <file> (optionnel)
titre: "Promotion KayyDrive"
description: "Offre spéciale"
type: "banner"
dateDebut: "2026-07-01T00:00:00Z"
dateFin: "2026-07-31T23:59:59Z"
```

**Réponse :**
```json
{
  "id": "ad-uuid",
  "titre": "Promotion KayyDrive",
  "description": "Offre spéciale",
  "type": "banner",
  "imageUrl": "https://minio-url/ad.jpg",
  "dateDebut": "2026-07-01T00:00:00Z",
  "dateFin": "2026-07-31T23:59:59Z",
  "actif": true
}
```

---

### DELETE /ads/:id
Supprimer une publicité (Admin uniquement).

**URL :** `http://localhost:3001/ads/:id`

**Méthode :** DELETE

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "success": true
}
```

---

## Récompenses (Rewards)

### GET /rewards
Récupérer toutes les récompenses actives.

**URL :** `http://localhost:3001/rewards`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
[
  {
    "id": "reward-uuid",
    "titre": "Réduction 10%",
    "description": "Sur votre prochain trajet",
    "points": 100,
    "type": "discount",
    "imageUrl": "https://minio-url/reward.jpg",
    "dateDebut": "2026-07-01T00:00:00Z",
    "dateFin": "2026-07-31T23:59:59Z",
    "actif": true
  }
]
```

---

### POST /rewards
Créer une récompense (Admin uniquement).

**URL :** `http://localhost:3001/rewards`

**Méthode :** POST

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**Body (FormData) :**
```
image: <file> (optionnel)
titre: "Réduction 10%"
description: "Sur votre prochain trajet"
points: 100
type: "discount"
dateDebut: "2026-07-01T00:00:00Z"
dateFin: "2026-07-31T23:59:59Z"
```

**Réponse :**
```json
{
  "id": "reward-uuid",
  "titre": "Réduction 10%",
  "description": "Sur votre prochain trajet",
  "points": 100,
  "type": "discount",
  "imageUrl": "https://minio-url/reward.jpg",
  "dateDebut": "2026-07-01T00:00:00Z",
  "dateFin": "2026-07-31T23:59:59Z",
  "actif": true
}
```

---

### DELETE /rewards/:id
Supprimer une récompense (Admin uniquement).

**URL :** `http://localhost:3001/rewards/:id`

**Méthode :** DELETE

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "success": true
}
```

---

## Dashboard (Admin)

### GET /dashboard/overview
Récupérer les statistiques générales du système.

**URL :** `http://localhost:3001/dashboard/overview`

**Méthode :** GET

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "totalUsers": 1000,
  "activeUsers": 750,
  "totalIncidents": 150,
  "totalRoutes": 200
}
```

---

### GET /dashboard/shortcuts
Récupérer les statistiques des raccourcis communautaires.

**URL :** `http://localhost:3001/dashboard/shortcuts`

**Méthode :** GET

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "totalShortcuts": 200,
  "averageRating": 4.5,
  "mostUsedShortcuts": [...]
}
```

---

### GET /dashboard/incidents
Récupérer les statistiques des incidents (Hydro-Guard).

**URL :** `http://localhost:3001/dashboard/incidents`

**Méthode :** GET

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "totalIncidents": 150,
  "confirmedIncidents": 120,
  "incidentsByType": {
    "inondation": 50,
    "travaux": 60,
    "accident": 40
  }
}
```

---

### GET /dashboard/safe-drive
Récupérer les statistiques Safe-Drive (qualité des routes).

**URL :** `http://localhost:3001/dashboard/safe-drive`

**Méthode :** GET

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "totalSecousses": 5000,
  "averageRoadQuality": 7.2,
  "problematicAreas": [...]
}
```

---

### GET /dashboard/engagement
Récupérer les statistiques d'engagement utilisateur.

**URL :** `http://localhost:3001/dashboard/engagement`

**Méthode :** GET

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "dailyActiveUsers": 500,
  "weeklyActiveUsers": 750,
  "monthlyActiveUsers": 1000
}
```

---

### GET /dashboard/performance
Récupérer les statistiques de performance système.

**URL :** `http://localhost:3001/dashboard/performance`

**Méthode :** GET

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "averageResponseTime": 150,
  "uptime": 99.9,
  "errorRate": 0.1
}
```

---

### GET /dashboard/all
Récupérer toutes les statistiques du dashboard.

**URL :** `http://localhost:3001/dashboard/all`

**Méthode :** GET

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "overview": {...},
  "shortcuts": {...},
  "incidents": {...},
  "safeDrive": {...},
  "engagement": {...},
  "performance": {...}
}
```

---

## Offline

### GET /offline/zones
Récupérer les zones disponibles pour le mode hors-ligne.

**URL :** `http://localhost:3001/offline/zones`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
[
  {
    "id": "zone-uuid",
    "nom": "Douala",
    "tailleMo": 150,
    "dateGeneration": "2026-07-01T00:00:00Z"
  }
]
```

---

### GET /offline/zones/:zoneId/metadata
Récupérer les métadonnées d'une zone hors-ligne.

**URL :** `http://localhost:3001/offline/zones/:zoneId/metadata`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "id": "zone-uuid",
  "nom": "Douala",
  "tailleMo": 150,
  "dateGeneration": "2026-07-01T00:00:00Z",
  "version": "1.0"
}
```

---

### GET /offline/zones/:zoneId/download
Télécharger une zone hors-ligne.

**URL :** `http://localhost:3001/offline/zones/:zoneId/download`

**Méthode :** GET

**Protection :** AuthGuard

**Headers :**
```
Authorization: Bearer <firebase-token>
```

**Réponse :**
```json
{
  "downloadUrl": "https://minio-url/offline/douala.zip",
  "checksum": "abc123"
}
```

---

### POST /offline/zones/:zoneId/generate
Générer une nouvelle zone hors-ligne (Admin uniquement).

**URL :** `http://localhost:3001/offline/zones/:zoneId/generate`

**Méthode :** POST

**Protection :** AuthGuard + AdminGuard

**Headers :**
```
Authorization: Bearer <admin-token>
```

**Réponse :**
```json
{
  "success": true,
  "message": "Génération en cours"
}
```

---

## Storage

### POST /storage/upload
Uploader une image.

**URL :** `http://localhost:3001/storage/upload`

**Méthode :** POST

**Protection :** Publique

**Headers :**
```
Content-Type: multipart/form-data
```

**Body (FormData) :**
```
file: <file>
folder: "incidents" (optionnel, défaut: "uploads")
```

**Restrictions :**
- Types autorisés : JPEG, PNG, WebP, GIF
- Taille maximale : 5MB

**Réponse :**
```json
{
  "url": "https://minio-url/incidents/image.jpg"
}
```

---

## Guide d'Implémentation

### Authentication Flow

1. **Inscription :**
```dart
final response = await http.post(
  Uri.parse('http://localhost:3001/auth/register'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'email': 'user@example.com',
    'password': 'password123',
    'displayName': 'John Doe'
  }),
);
final data = jsonDecode(response.body);
final user = data['user'];
```

2. **Connexion :**
```dart
final response = await http.post(
  Uri.parse('http://localhost:3001/auth/login'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'email': 'user@example.com',
    'password': 'password123'
  }),
);
final data = jsonDecode(response.body);
final token = data['token'];
await prefs.setString('token', token);
```

3. **Utilisation du token :**
```dart
final token = await prefs.getString('token');
final response = await http.get(
  Uri.parse('http://localhost:3001/auth/me'),
  headers: {'Authorization': 'Bearer $token'},
);
```

---

### Navigation Flow Complet

```dart
// 1. Calcul initial de l'itinéraire
final response = await http.get(
  Uri.parse('http://localhost:3001/route/smart?startLat=$startLat&startLng=$startLng&endLat=$endLat&endLng=$endLng'),
);
final route = jsonDecode(response.body);

// 2. Snap-to-road des positions GPS
final snappedResponse = await http.post(
  Uri.parse('http://localhost:3001/route/snap-to-road'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'coordinates': rawCoordinates,
  }),
);
final snapped = jsonDecode(snappedResponse.body);

// Utilisez snapped['snappedCoordinates'] pour l'affichage

// 3. Guidage vocal avec les maneuvers
for (var instruction in route['instructions']) {
  // Déclenchez l'annonce quand l'utilisateur est à instruction['distance'] mètres
  if (userDistanceToInstruction < instruction['distance']) {
    speak(instruction['text']); // Synthèse vocale
    displayInstruction(instruction); // Affichage UI
  }
}

// 4. Surveillance et recalcule automatique
Timer.periodic(Duration(seconds: 5), (timer) async {
  final userPosition = getCurrentUserPosition();
  final distance = calculateDistanceToRoute(userPosition, route);
  
  if (distance > 50) {
    final newRouteResponse = await http.post(
      Uri.parse('http://localhost:3001/route/reroute'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'currentLat': userPosition['latitude'],
        'currentLng': userPosition['longitude'],
        'endLat': endLat,
        'endLng': endLng,
      }),
    );
    final newRoute = jsonDecode(newRouteResponse.body);
    updateRoute(newRoute);
    speak("Recalcul de l'itinéraire...");
  }
});
```

---

### Upload d'Image (Incident)

```dart
final request = http.MultipartRequest('POST', Uri.parse('http://localhost:3001/incidents'));
request.headers['Authorization'] = 'Bearer $token';
request.files.add(await http.MultipartFile.fromPath('image', imageFile.path));
request.fields['type'] = 'inondation';
request.fields['description'] = 'Route inondée';
request.fields['latitude'] = '3.8488';
request.fields['longitude'] = '11.5021';

final response = await http.send(request);
final data = jsonDecode(response.body);
final incident = data['incident'];
```

---

### Gestion des Erreurs

Toutes les routes retournent des codes HTTP appropriés :
- `200` : Succès
- `201` : Création réussie
- `400` : Requête invalide
- `401` : Non authentifié
- `403` : Non autorisé (Admin requis)
- `404` : Ressource non trouvée
- `500` : Erreur serveur

**Exemple de gestion d'erreur :**
```dart
try {
  final response = await http.get(
    Uri.parse('http://localhost:3001/incidents'),
    headers: {'Authorization': 'Bearer $token'},
  );
  
  if (response.statusCode != 200) {
    if (response.statusCode == 401) {
      // Rediriger vers login
      Navigator.pushReplacementNamed(context, '/login');
    } else if (response.statusCode == 403) {
      // Afficher message "Accès refusé"
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Vous n'avez pas les droits nécessaires")),
      );
    }
  }
  
  final data = jsonDecode(response.body);
} catch (error) {
  print('Erreur: $error');
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text('Erreur de connexion au serveur')),
  );
}
```

---

## Support

Pour toute question sur l'implémentation de ces endpoints, contactez l'équipe backend.
