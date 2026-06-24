from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from app.schemas.road import SafeDriveRequest, SafeDriveResponse
from app.schemas.traffic import TrafficRequest, TrafficResponse
from app.schemas.prediction import PredictionInput, PredictionOutput, BatchPredictionInput, BatchPredictionOutput
from app.ml.pothole_filter import pothole_filter
from app.ml.safe_drive_score import safe_drive_score
from app.ml.traffic_predictor import traffic_predictor

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Microservice IA Kayy Drive démarré ✅")
    yield
    print("Microservice IA Kayy Drive arrêté.")

app = FastAPI(
    title="Kayy Drive - Microservice IA",
    description="Prédiction trafic, filtrage nids-de-poule, score Safe-Drive",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


#Health Check

@app.get("/health", tags=["Monitoring"])
def health_check():
    return {
        "status": "ok",
        "service": "ia-service",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development")
    }


#Pothole Filter (Tâche 11.1)

@app.post("/ia/pothole", tags=["IA"])
def detect_pothole(
    axe_x: float,
    axe_y: float,
    axe_z: float,
    duree: float,
    vitesse_kmh: float
):
    """
    Filtre les faux nids-de-poule à partir des données de l'accéléromètre.
    Reçoit les données brutes de Cindy (Queue Redis / BullMQ).
    """
    try:
        result = pothole_filter.predict(axe_x, axe_y, axe_z, duree, vitesse_kmh)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Safe-Drive Score (Tâche 11.3)

@app.post("/ia/safe-drive", response_model=SafeDriveResponse, tags=["IA"])
def calculate_safe_drive(request: SafeDriveRequest):
    """
    Calcule le score de confort routier pour un segment de route.
    Reçoit les données de Map-Matching d'Atouga.
    """
    try:
        result = safe_drive_score.calculate(
            nids_de_poule=0,
            intensite_secousse=request.intensite_secousse,
            vitesse_kmh=request.vitesse_kmh or 40.0,
            signalements=0
        )
        return SafeDriveResponse(
            segment_id=request.segment.segment_id,
            score_confort=result["score_confort"],
            niveau=result["niveau"],
            est_nid_de_poule=False
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Traffic Predictor (Tâche 11.2)

@app.post("/ia/traffic", response_model=TrafficResponse, tags=["IA"])
def predict_traffic(request: TrafficRequest):
    """
    Prédit le niveau de trafic en fonction de l'heure, du jour et de la météo.
    Utilisé par Lionel pour le moteur de routage intelligent (/route/smart).
    """
    try:
        heure = request.timestamp.hour if request.timestamp else 8
        jour = request.timestamp.weekday() if request.timestamp else 0
        meteo = request.meteo or "soleil"

        result = traffic_predictor.predict(
            heure=heure,
            jour_semaine=jour,
            meteo=meteo
        )
        return TrafficResponse(
            niveau_trafic=result["niveau_trafic"],
            temps_estime_minutes=int(result["score_trafic"] / 2),
            confiance=result["confiance"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Batch Prediction (bonus pour Lionel - /route/smart)

@app.post("/ia/traffic/batch", response_model=BatchPredictionOutput, tags=["IA"])
def predict_traffic_batch(batch: BatchPredictionInput):
    """
    Prédit le trafic pour plusieurs points en une seule requête.
    Optimisé pour le calcul d'itinéraires multi-segments.
    """
    resultats = []
    for item in batch.predictions:
        heure = item.heure
        jour = item.jour_semaine
        meteo = item.meteo or "soleil"

        result = traffic_predictor.predict(heure=heure, jour_semaine=jour, meteo=meteo)
        resultats.append(PredictionOutput(
            niveau_trafic=result["niveau_trafic"],
            score_confiance=result["confiance"],
            temps_trajet_estime=int(result["score_trafic"] / 2),
            recommandation=None
        ))

    return BatchPredictionOutput(resultats=resultats, total=len(resultats))