import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

function distanceEnMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
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
  constructor(private readonly prisma: PrismaService) {}

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

    const incident = await this.prisma.incident.create({
      data: {
        type:
          data.type === 'inondation'
            ? 'INONDATION'
            : data.type === 'travaux'
              ? 'QUALITE_ROUTE'
              : 'TRAFIC',
        description: data.description,
        horodatage: now,
        nombreValidations: 1,
        statut: 'non_confirme',
        idRapporteur: data.id_utilisateur_createur,
        dateExpiration: expiration,
        confirmePar: [data.id_utilisateur_createur],
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    return {
      id: incident.id,
      type:
        incident.type === 'INONDATION'
          ? 'inondation'
          : incident.type === 'QUALITE_ROUTE'
            ? 'travaux'
            : 'accident',
      description: incident.description || '',
      latitude: incident.latitude || 0,
      longitude: incident.longitude || 0,
      id_utilisateur_createur: incident.idRapporteur,
      statut: incident.statut as IncidentStatut,
      nombreConfirmations: incident.nombreValidations,
      confirmePar: incident.confirmePar,
      dateCreation: incident.horodatage.toISOString(),
      dateExpiration: incident.dateExpiration?.toISOString() || '',
    };
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
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException('Incident introuvable');
    }

    if (incident.dateExpiration && incident.dateExpiration < new Date()) {
      throw new BadRequestException('Cet incident a expiré');
    }

    if (incident.confirmePar.includes(uid)) {
      throw new BadRequestException('Vous avez déjà confirmé cet incident');
    }

    const nouvelleListe = [...incident.confirmePar, uid];
    const nouveauNombre = nouvelleListe.length;
    const nouveauStatut: string =
      nouveauNombre >= SEUIL_CONFIRMATIONS ? 'confirme' : incident.statut;

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: {
        confirmePar: nouvelleListe,
        nombreValidations: nouveauNombre,
        statut: nouveauStatut,
      },
    });

    return {
      message:
        nouveauStatut === 'confirme'
          ? 'Incident confirmé par la communauté !'
          : 'Confirmation enregistrée',
      incident: {
        id: updated.id,
        type:
          updated.type === 'INONDATION'
            ? 'inondation'
            : updated.type === 'QUALITE_ROUTE'
              ? 'travaux'
              : 'accident',
        description: updated.description || '',
        latitude: updated.latitude || 0,
        longitude: updated.longitude || 0,
        id_utilisateur_createur: updated.idRapporteur,
        statut: updated.statut as IncidentStatut,
        nombreConfirmations: updated.nombreValidations,
        confirmePar: updated.confirmePar,
        dateCreation: updated.horodatage.toISOString(),
        dateExpiration: updated.dateExpiration?.toISOString() || '',
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
    const incidents = await this.prisma.incident.findMany({
      where: {
        dateExpiration: {
          gt: new Date(),
        },
      },
    });

    return incidents
      .filter(
        (incident) =>
          incident.latitude &&
          incident.longitude &&
          distanceEnMetres(
            latitude,
            longitude,
            incident.latitude,
            incident.longitude,
          ) <= rayonMetres,
      )
      .map((incident) => ({
        id: incident.id,
        type:
          incident.type === 'INONDATION'
            ? 'inondation'
            : incident.type === 'QUALITE_ROUTE'
              ? 'travaux'
              : 'accident',
        description: incident.description || '',
        latitude: incident.latitude || 0,
        longitude: incident.longitude || 0,
        id_utilisateur_createur: incident.idRapporteur,
        statut: incident.statut as IncidentStatut,
        nombreConfirmations: incident.nombreValidations,
        confirmePar: incident.confirmePar,
        dateCreation: incident.horodatage.toISOString(),
        dateExpiration: incident.dateExpiration?.toISOString() || '',
      }));
  }

  async resoudreIncident(incidentId: string): Promise<void> {
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { statut: 'resolu' },
    });
  }
}
