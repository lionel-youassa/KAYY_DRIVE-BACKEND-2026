@echo off
REM Script pour générer les données OSRM du Cameroun (Windows)
REM Usage: generate-osrm-data.bat

setlocal enabledelayedexpansion

REM Configuration
set OSRM_DATA_DIR=.\osrm-data
set OSM_FILE=cameroon-latest.osm.pbf
set OSRM_FILE=cameroon-latest.osrm
set OSRM_IMAGE=osrm/osrm-backend:latest
set OSRM_PROFILE=/opt/car.lua

echo === Génération des données OSRM pour le Cameroun ===

REM Créer le répertoire si nécessaire
if not exist "%OSRM_DATA_DIR%" (
    echo Création du répertoire %OSRM_DATA_DIR%...
    mkdir "%OSRM_DATA_DIR%"
)

cd "%OSRM_DATA_DIR%"

REM Vérifier si Docker est installé
docker --version >nul 2>&1
if errorlevel 1 (
    echo Erreur: Docker n'est pas installé. Veuillez installer Docker Desktop d'abord.
    exit /b 1
)

REM Étape 1: Télécharger les données OSM du Cameroun
if not exist "%OSM_FILE%" (
    echo Téléchargement des données OSM du Cameroun depuis Geofabrik...
    curl -L -o "%OSM_FILE%" https://download.geofabrik.de/africa/cameroon-latest.osm.pbf
) else (
    echo Le fichier %OSM_FILE% existe déjà. Téléchargement ignoré.
)

REM Étape 2: Extraire les données avec le profil car
echo Extraction des données avec le profil car...
docker run -t -v "%CD%:/data" %OSRM_IMAGE% osrm-extract -p %OSRM_PROFILE% /data/%OSM_FILE%

REM Étape 3: Partitionner les données
echo Partitionnement des données...
docker run -t -v "%CD%:/data" %OSRM_IMAGE% osrm-partition /data/%OSRM_FILE%

REM Étape 4: Personnaliser les données
echo Personnalisation des données...
docker run -t -v "%CD%:/data" %OSRM_IMAGE% osrm-customize /data/%OSRM_FILE%

echo === Génération terminée avec succès ===
echo Les fichiers OSRM sont disponibles dans: %OSRM_DATA_DIR%
echo Pour démarrer le serveur OSRM, utilisez:
echo docker run -t -i -p 5000:5000 -v "%CD%:/data" %OSRM_IMAGE% osrm-routed --algorithm mld /data/%OSRM_FILE%

cd ..
