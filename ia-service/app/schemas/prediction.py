from pydantic import BaseModel
from typing import List, Optional

class PredictionInput(BaseModel):
    latitude: float
    longitude: float
    heure: int
    jour_semaine: int
    meteo: Optional[str] = "soleil"

class PredictionOutput(BaseModel):
    niveau_trafic: str
    score_confiance: float
    temps_trajet_estime: int
    recommandation: Optional[str] = None

class BatchPredictionInput(BaseModel):
    predictions: List[PredictionInput]

class BatchPredictionOutput(BaseModel):
    resultats: List[PredictionOutput]
    total: int