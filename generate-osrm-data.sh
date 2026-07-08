#!/bin/bash

# Script pour générer les données OSRM du Cameroun
# Usage: ./generate-osrm-data.sh

set -e  # Arrête le script si une commande échoue

# Configuration
OSRM_DATA_DIR="./osrm-data"
OSM_FILE="cameroon-latest.osm.pbf"
OSRM_FILE="cameroon-latest.osrm"
OSRM_IMAGE="osrm/osrm-backend:latest"
OSRM_PROFILE="/opt/car.lua"  # Profil pour les voitures (car, foot, bike disponibles)

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Génération des données OSRM pour le Cameroun ===${NC}"

# Créer le répertoire si nécessaire
if [ ! -d "$OSRM_DATA_DIR" ]; then
    echo -e "${YELLOW}Création du répertoire $OSRM_DATA_DIR...${NC}"
    mkdir -p "$OSRM_DATA_DIR"
fi

cd "$OSRM_DATA_DIR"

# Vérifier si Docker est installé
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Erreur: Docker n'est pas installé. Veuillez installer Docker d'abord.${NC}"
    exit 1
fi

# Étape 1: Télécharger les données OSM du Cameroun
if [ ! -f "$OSM_FILE" ]; then
    echo -e "${YELLOW}Téléchargement des données OSM du Cameroun depuis Geofabrik...${NC}"
    wget https://download.geofabrik.de/africa/cameroon-latest.osm.pbf
else
    echo -e "${GREEN}Le fichier $OSM_FILE existe déjà. Téléchargement ignoré.${NC}"
fi

# Étape 2: Extraire les données avec le profil car
echo -e "${YELLOW}Extraction des données avec le profil car...${NC}"
docker run -t -v "${PWD}:/data" "$OSRM_IMAGE" osrm-extract -p "$OSRM_PROFILE" "/data/$OSM_FILE"

# Étape 3: Partitionner les données
echo -e "${YELLOW}Partitionnement des données...${NC}"
docker run -t -v "${PWD}:/data" "$OSRM_IMAGE" osrm-partition "/data/$OSRM_FILE"

# Étape 4: Personnaliser les données
echo -e "${YELLOW}Personnalisation des données...${NC}"
docker run -t -v "${PWD}:/data" "$OSRM_IMAGE" osrm-customize "/data/$OSRM_FILE"

echo -e "${GREEN}=== Génération terminée avec succès ===${NC}"
echo -e "${GREEN}Les fichiers OSRM sont disponibles dans: $OSRM_DATA_DIR${NC}"
echo -e "${YELLOW}Pour démarrer le serveur OSRM, utilisez:${NC}"
echo -e "${YELLOW}docker run -t -i -p 5000:5000 -v \"\${PWD}:/data\" $OSRM_IMAGE osrm-routed --algorithm mld /data/$OSRM_FILE${NC}"
