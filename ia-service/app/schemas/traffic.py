from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TrafficRequest(BaseModel):
    latitude: float
    longitude: float
    timestamp: Optional[datetime] = None
    meteo: Optional[str] = None

class TrafficResponse(BaseModel):
    niveau_trafic: str
    temps_estime_minutes: int
    confiance: float