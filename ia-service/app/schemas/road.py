from pydantic import BaseModel
from typing import Optional

class RoadSegment(BaseModel):
    segment_id: str
    latitude_debut: float
    longitude_debut: float
    latitude_fin: float
    longitude_fin: float

class SafeDriveRequest(BaseModel):
    segment: RoadSegment
    intensite_secousse: float
    vitesse_kmh: Optional[float] = None

class SafeDriveResponse(BaseModel):
    segment_id: str
    score_confort: float
    niveau: str
    est_nid_de_poule: bool