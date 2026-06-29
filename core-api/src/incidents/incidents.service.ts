import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

export type IncidentType = 'inondation' | 'travaux' | 'accident';
export type IncidentStatut = 'non_confirme' | 'confirme' | 'resolu' | 'expire';

export interface Incident {
  id?: string;
  type: IncidentType;
  description: string;
  latitude: number;
  longitude: number;
  id_utilisateur_createur: string;
  statut: IncidentStatut;
  nombreConfirmations: number;
  confirmePar: string[];
  dateCreation: string;
  dateExpiration: string;
}

const RAYON_VALIDATION_METRES = 500;
const SEUIL_CONFIRMATIONS = 3;
const DUREE_VIE_HEURES: Record<IncidentType, number> = {
  inondation: 6,
  travaux: 48,
  accident: 3,
};

function distanceEnMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class IncidentsService {
  constructor(private readonly firebase: FirebaseService) {}

  // -------------------------------------------------------------------------
  // 8.1 : Création d'un signalement
  // -------------------------------------------------------------------------
  async createIncident(data: {
    type: IncidentType;
    description: string;
    latitude: number;
    longitude: number;
    id_utilisateur_createur: string;
  }): Promise<Incident> {
    const now = new Date();
    const expiration = new Date(
      now.getTime() + DUREE_VIE_HEURES[data.type] * 60 * 60 * 1000,
    );

    const incident: Incident = {
      ...data,
      statut: 'non_confirme',
      nombreConfirmations: 1,
      confirmePar: [data.id_utilisateur_createur],
      dateCreation: now.toISOString(),
      dateExpiration: expiration.toISOString(),
    };

    const docRef = await this.firebase.db.collection('incidents').add(incident);
    return { ...incident, id: docRef.id };
  }

  // -------------------------------------------------------------------------
  // 8.2 : Confirmation par proximité GPS
  // -------------------------------------------------------------------------
  async confirmerIncident(
    incidentId: string,
    uid: string,
    latitudeUtilisateur: number,
    longitudeUtilisateur: number,
  ): Promise<{ message: string; incident: Incident }> {
    const docRef = this.firebase.db.collection('incidents').doc(incidentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException('Incident introuvable');
    }

    const incident = doc.data() as Incident;

    if (new Date(incident.dateExpiration) < new Date()) {
      throw new BadRequestException('Cet incident a expiré');
    }

    if (incident.confirmePar.includes(uid)) {
      throw new BadRequestException('Vous avez déjà confirmé cet incident');
    }

    const distance = distanceEnMetres(
      incident.latitude,
      incident.longitude,
      latitudeUtilisateur,
      longitudeUtilisateur,
    );

    if (distance > RAYON_VALIDATION_METRES) {
      throw new BadRequestException(
        `Vous êtes trop loin (${Math.round(distance)}m) pour confirmer. Rayon requis : ${RAYON_VALIDATION_METRES}m`,
      );
    }

    const nouvelleListe = [...incident.confirmePar, uid];
    const nouveauNombre = nouvelleListe.length;
    const nouveauStatut: IncidentStatut =
      nouveauNombre >= SEUIL_CONFIRMATIONS ? 'confirme' : incident.statut;

    await docRef.update({
      confirmePar: nouvelleListe,
      nombreConfirmations: nouveauNombre,
      statut: nouveauStatut,
    });

    return {
      message:
        nouveauStatut === 'confirme'
          ? 'Incident confirmé par la communauté !'
          : 'Confirmation enregistrée',
      incident: {
        ...incident,
        confirmePar: nouvelleListe,
        nombreConfirmations: nouveauNombre,
        statut: nouveauStatut,
        id: incidentId,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Incidents actifs proches d'une position
  // -------------------------------------------------------------------------
  async getIncidentsProches(
    latitude: number,
    longitude: number,
    rayonMetres = 5000,
  ): Promise<Incident[]> {
    const snapshot = await this.firebase.db
      .collection('incidents')
      .where('dateExpiration', '>', new Date().toISOString())
      .get();

    const incidents = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      ...(doc.data() as Incident),
      id: doc.id,
    }));

    return incidents.filter(
      (incident: Incident) =>
        distanceEnMetres(latitude, longitude, incident.latitude, incident.longitude) <=
        rayonMetres,
    );
  }

  async resoudreIncident(incidentId: string): Promise<void> {
    await this.firebase.db.collection('incidents').doc(incidentId).update({ statut: 'resolu' });
  }
}
