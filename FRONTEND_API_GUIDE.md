# Guide API Frontend - Navigation Avancée

## Nouveaux Endpoints pour la Navigation

Ce document décrit les nouveaux endpoints ajoutés pour supporter le guidage vocal, le snap-to-road et le recalcule automatique d'itinéraire.

---

## 1. Maneuvers Améliorés (Instructions de Guidage)

### Endpoint : GET /route/smart

Les instructions de navigation ont été améliorées pour inclure des informations détaillées pour le guidage vocal.

**Changements dans la réponse :**
- Chaque instruction inclut maintenant : `type`, `streetName`, `instructionIndex`
- Les instructions textuelles sont plus précises avec les noms de rues de destination

**Exemple de réponse :**
```json
{
  "instructions": [
    {
      "text": "Départ de Avenue Kennedy",
      "distance": 0,
      "duration": 0,
      "location": [11.5021, 3.8488],
      "type": "depart",
      "streetName": "Avenue Kennedy",
      "instructionIndex": 0
    },
    {
      "text": "Dans 100 m, tournez à droite vers Boulevard de la Liberté",
      "distance": 100,
      "duration": 15,
      "location": [11.5030, 3.8490],
      "type": "turn",
      "streetName": "Avenue Kennedy",
      "instructionIndex": 1
    },
    {
      "text": "Arrivée à Place du Gouvernement",
      "distance": 0,
      "duration": 0,
      "location": [11.5100, 3.8500],
      "type": "arrive",
      "streetName": "Place du Gouvernement",
      "instructionIndex": 2
    }
  ]
}
```

**Utilisation pour le guidage vocal :**
- Utilisez le champ `text` pour la synthèse vocale
- Utilisez `distance` pour déclencher l'annonce au bon moment
- Utilisez `type` pour adapter le ton de la voix (ex: "tournez" vs "arrivée")
- Utilisez `streetName` pour afficher le nom de la rue sur l'interface

---

## 2. Snap-to-Road (Recalage GPS)

### Endpoint : POST /route/snap-to-road

Recale les coordonnées GPS brutes sur la route la plus proche pour éviter que le point bleu ne tremble ou ne traverse des immeubles.

**URL :** `http://localhost:3001/route/snap-to-road`

**Méthode :** POST

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

**Format des coordonnées :** `[longitude, latitude]` (format GeoJSON)

**Réponse :**
```json
{
  "snappedCoordinates": [
    [11.5022, 3.8489],
    [11.5031, 3.8491],
    [11.5101, 3.8501]
  ],
  "confidence": 0.95,
  "distance": 15000,
  "duration": 2100
}
```

**Champs de réponse :**
- `snappedCoordinates`: Coordonnées recalées sur la route
- `confidence`: Niveau de confiance du recalage (0-1)
- `distance`: Distance totale du tracé recalé (mètres)
- `duration`: Durée estimée du tracé (secondes)

**Cas d'erreur :**
```json
null
```
Retourne `null` si le recalage échoue (ex: coordonnées trop loin de toute route)

**Implémentation recommandée :**
1. Envoyez les dernières positions GPS de l'utilisateur (ex: 5-10 points)
2. Remplacez les coordonnées brutes par les coordonnées recalées
3. Affichez le point recalé sur la carte
4. Utilisez le niveau de confiance pour ajuster la visibilité du point

**Exemple d'appel (JavaScript) :**
```javascript
const response = await fetch('http://localhost:3001/route/snap-to-road', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    coordinates: [
      [11.5021, 3.8488],
      [11.5030, 3.8490],
      [11.5100, 3.8500]
    ]
  })
});

const result = await response.json();
if (result) {
  // Utiliser result.snappedCoordinates
  console.log('Confiance:', result.confidence);
}
```

---

## 3. Recalcule Automatique d'Itinéraire

### Endpoint : POST /route/reroute

Recalcule automatiquement l'itinéraire si l'utilisateur s'éloigne du tracé initial (plus de 50m).

**URL :** `http://localhost:3001/route/reroute`

**Méthode :** POST

**Body :**
```json
{
  "currentLat": 3.8488,
  "currentLng": 11.5021,
  "endLat": 3.8500,
  "endLng": 11.5100
}
```

**Champs :**
- `currentLat`: Latitude actuelle de l'utilisateur
- `currentLng`: Longitude actuelle de l'utilisateur
- `endLat`: Latitude de destination (inchangée)
- `endLng`: Longitude de destination (inchangée)

**Réponse :**
```json
{
  "duration": 2100,
  "distance": 15000,
  "geometry": {
    "type": "LineString",
    "coordinates": [
      [11.5021, 3.8488],
      [11.5030, 3.8490],
      [11.5100, 3.8500]
    ]
  },
  "instructions": [...],
  "suggestedLocalRoutes": [...],
  "incidentsOnRoute": [...],
  "trafficPrediction": {...},
  "smartFeatures": {
    "trafficEnabled": true,
    "localRoutesEnabled": true,
    "incidentsEnabled": true
  }
}
```

**La réponse est identique à GET /route/smart** avec les nouvelles instructions recalculées.

**Implémentation recommandée :**
1. Surveillez la distance entre la position de l'utilisateur et le tracé actuel
2. Si la distance > 50m, appelez cet endpoint
3. Remplacez l'itinéraire actuel par le nouvel itinéraire
4. Mettez à jour les instructions de guidage vocal
5. Informez l'utilisateur du recalcule (ex: "Recalcul de l'itinéraire...")

**Exemple d'appel (JavaScript) :**
```javascript
async function checkAndReroute(userPosition, currentRoute, destination) {
  const distance = calculateDistanceToRoute(userPosition, currentRoute);
  
  if (distance > 50) {
    // L'utilisateur s'est éloigné du tracé
    const response = await fetch('http://localhost:3001/route/reroute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentLat: userPosition.latitude,
        currentLng: userPosition.longitude,
        endLat: destination.latitude,
        endLng: destination.longitude
      })
    });
    
    const newRoute = await response.json();
    return newRoute; // Nouvel itinéraire recalculé
  }
  
  return null; // Pas de recalcule nécessaire
}
```

---

## 4. Workflow Complet de Navigation

Voici le workflow recommandé pour une navigation complète :

### Étape 1 : Calcul initial de l'itinéraire
```javascript
const initialRoute = await fetch(
  `http://localhost:3001/route/smart?startLat=${startLat}&startLng=${startLng}&endLat=${endLat}&endLng=${endLng}`
).then(r => r.json());
```

### Étape 2 : Snap-to-road des positions GPS
```javascript
// Envoyez les positions GPS brutes pour recalage
const snapped = await fetch('http://localhost:3001/route/snap-to-road', {
  method: 'POST',
  body: JSON.stringify({ coordinates: rawCoordinates })
}).then(r => r.json());

// Utilisez snapped.snappedCoordinates pour l'affichage
```

### Étape 3 : Guidage vocal avec les maneuvers
```javascript
initialRoute.instructions.forEach((instruction, index) => {
  // Déclenchez l'annonce quand l'utilisateur est à instruction.distance mètres
  if (userDistanceToInstruction < instruction.distance) {
    speak(instruction.text); // Synthèse vocale
    displayInstruction(instruction); // Affichage UI
  }
});
```

### Étape 4 : Surveillance et recalcule automatique
```javascript
// Vérifiez périodiquement (ex: toutes les 5 secondes)
setInterval(async () => {
  const userPosition = getCurrentUserPosition();
  const distance = calculateDistanceToRoute(userPosition, currentRoute);
  
  if (distance > 50) {
    const newRoute = await fetch('http://localhost:3001/route/reroute', {
      method: 'POST',
      body: JSON.stringify({
        currentLat: userPosition.latitude,
        currentLng: userPosition.longitude,
        endLat: destination.latitude,
        endLng: destination.longitude
      })
    }).then(r => r.json());
    
    updateRoute(newRoute);
    speak("Recalcul de l'itinéraire...");
  }
}, 5000);
```

---

## 5. Gestion des Erreurs

### Snap-to-road échoue
```javascript
const snapped = await fetch('http://localhost:3001/route/snap-to-road', {
  method: 'POST',
  body: JSON.stringify({ coordinates: rawCoordinates })
}).then(r => r.json());

if (!snapped) {
  // Utilisez les coordonnées brutes comme fallback
  displayRawCoordinates(rawCoordinates);
} else {
  displaySnappedCoordinates(snapped.snappedCoordinates);
}
```

### Recalcule échoue
```javascript
try {
  const newRoute = await fetch('http://localhost:3001/route/reroute', {...});
  updateRoute(newRoute);
} catch (error) {
  // Continuez sur l'itinéraire actuel
  console.error('Échec du recalcule:', error);
  showErrorMessage('Impossible de recalculer l\'itinéraire');
}
```

---

## 6. Notes Importantes

### Performance
- Le snap-to-road peut prendre 100-500ms selon le nombre de points
- Le recalcule d'itinéraire peut prendre 1-3 secondes
- Cachez les résultats si possible

### Fréquence d'appel
- Snap-to-road : toutes les 2-5 secondes (ou selon la fréquence GPS)
- Recalcule : uniquement quand distance > 50m (évitez les appels inutiles)

### UX
- Informez l'utilisateur lors du recalcule
- Utilisez des animations fluides pour les transitions d'itinéraire
- Affichez le niveau de confiance du snap-to-road (ex: point semi-transparent si confiance < 0.7)

---

## 7. Exemple Complet (React)

```javascript
import { useState, useEffect } from 'react';

function Navigation({ start, end }) {
  const [route, setRoute] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [snappedPosition, setSnappedPosition] = useState(null);

  // 1. Calcul initial de l'itinéraire
  useEffect(() => {
    async function fetchRoute() {
      const response = await fetch(
        `http://localhost:3001/route/smart?startLat=${start.lat}&startLng=${start.lng}&endLat=${end.lat}&endLng=${end.lng}`
      );
      const data = await response.json();
      setRoute(data);
    }
    fetchRoute();
  }, [start, end]);

  // 2. Snap-to-road des positions GPS
  useEffect(() => {
    if (!userPosition) return;

    async function snapPosition() {
      const response = await fetch('http://localhost:3001/route/snap-to-road', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coordinates: [[userPosition.lng, userPosition.lat]]
        })
      });
      const data = await response.json();
      if (data) {
        setSnappedPosition({
          lat: data.snappedCoordinates[0][1],
          lng: data.snappedCoordinates[0][0]
        });
      }
    }
    snapPosition();
  }, [userPosition]);

  // 3. Surveillance et recalcule automatique
  useEffect(() => {
    if (!route || !userPosition) return;

    const interval = setInterval(async () => {
      const distance = calculateDistance(userPosition, route);
      
      if (distance > 50) {
        const response = await fetch('http://localhost:3001/route/reroute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentLat: userPosition.lat,
            currentLng: userPosition.lng,
            endLat: end.lat,
            endLng: end.lng
          })
        });
        const newRoute = await response.json();
        setRoute(newRoute);
        speak("Recalcul de l'itinéraire...");
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [route, userPosition, end]);

  return (
    <div>
      {route && (
        <div>
          <h2>Instructions de guidage</h2>
          {route.instructions.map((instruction, index) => (
            <div key={index}>
              <p>{instruction.text}</p>
              <small>{instruction.distance}m</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Support

Pour toute question sur l'implémentation de ces endpoints, contactez l'équipe backend.
