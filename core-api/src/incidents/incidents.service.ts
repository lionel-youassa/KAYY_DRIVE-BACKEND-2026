import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';

export type IncidentType =
  | 'inondation'
  | 'travaux'
  | 'accident'
  | 'bouchon'
  | 'route_degradee'
  | 'endomage';
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
  imageUrl?: string;
}

const RAYON_VALIDATION_METRES = 500;
const SEUIL_CONFIRMATIONS = 3;
const DUREE_VIE_HEURES: Record<IncidentType, number> = {
  inondation: 6,
  travaux: 48,
  accident: 3,
  bouchon: 2,
  route_degradee: 72,
  endomage: 72,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocodingService: GeocodingService,
  ) {}

  // -------------------------------------------------------------------------
  // 8.1 : Création d'un signalement
  // -------------------------------------------------------------------------
  async createIncident(data: {
    type: IncidentType;
    description: string;
    latitude: number;
    longitude: number;
    id_utilisateur_createur: string;
    imageUrl?: string;
  }): Promise<Incident> {
    const now = new Date();
    const expiration = new Date(
      now.getTime() + DUREE_VIE_HEURES[data.type] * 60 * 60 * 1000,
    );

    // Résolution géocodage inverse des coordonnées de l'incident
    const zoneInfo = await this.geocodingService.reverse(data.latitude, data.longitude);

    const incident = await this.prisma.incident.create({
      data: {
        type:
          data.type === 'inondation'
            ? 'INONDATION'
            : data.type === 'travaux' || data.type === 'route_degradee'
              ? 'QUALITE_ROUTE'
              : data.type === 'endomage'
                ? 'ROUTE_ENDOMMAGEE'
                : 'TRAFIC',
        description: data.description,
        horodatage: now,
        nombreConfirmations: 1,
        statut: 'non_confirme',
        idRapporteur: data.id_utilisateur_createur,
        id_utilisateur_createur: data.id_utilisateur_createur,
        dateExpiration: expiration,
        confirmePar: [data.id_utilisateur_createur],
        latitude: data.latitude,
        longitude: data.longitude,
        imageUrl: data.imageUrl,
        quartier: zoneInfo.quartier || null,
        ville: zoneInfo.ville || null,
        region: zoneInfo.region || null,
      },
    });

    return {
      id: incident.id,
      type:
        incident.type === 'INONDATION'
          ? 'inondation'
          : incident.type === 'QUALITE_ROUTE'
            ? 'travaux'
            : incident.type === 'ROUTE_ENDOMMAGEE'
              ? 'endomage'
              : 'accident',
      description: incident.description || '',
      latitude: incident.latitude || 0,
      longitude: incident.longitude || 0,
      id_utilisateur_createur: incident.idRapporteur,
      statut: incident.statut as IncidentStatut,
      nombreConfirmations: incident.nombreConfirmations,
      confirmePar: incident.confirmePar,
      dateCreation: incident.horodatage.toISOString(),
      dateExpiration: incident.dateExpiration?.toISOString() || '',
      imageUrl: incident.imageUrl || undefined,
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
        nombreConfirmations: nouveauNombre,
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
        nombreConfirmations: updated.nombreConfirmations,
        confirmePar: updated.confirmePar,
        dateCreation: updated.horodatage.toISOString(),
        dateExpiration: updated.dateExpiration?.toISOString() || '',
        imageUrl: updated.imageUrl || undefined,
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
    filterType?: string,
  ): Promise<Incident[]> {
    let filterQuartier: string | undefined;
    let filterVille: string | undefined;
    let filterRegion: string | undefined;

    if (filterType === 'quartier' || filterType === 'ville' || filterType === 'region') {
      const userGeo = await this.geocodingService.reverse(latitude, longitude);
      filterQuartier = userGeo.quartier;
      filterVille = userGeo.ville;
      filterRegion = userGeo.region;
    }

    const incidents = await this.prisma.incident.findMany({
      where: {
        dateExpiration: {
          gt: new Date(),
        },
      },
    });

    return incidents
      .filter((incident) => {
        if (!incident.latitude || !incident.longitude) return false;

        // Si filtrage spécifique
        if (filterType === 'quartier' && filterQuartier && incident.quartier) {
          return incident.quartier.toLowerCase() === filterQuartier.toLowerCase();
        }
        if (filterType === 'ville' && filterVille && incident.ville) {
          return incident.ville.toLowerCase() === filterVille.toLowerCase();
        }
        if (filterType === 'region' && filterRegion && incident.region) {
          return incident.region.toLowerCase() === filterRegion.toLowerCase();
        }

        // Sinon, repli par défaut sur la distance géographique (rayon)
        let currentRayon = rayonMetres;
        if (filterType === 'quartier') currentRayon = 3000;
        else if (filterType === 'ville') currentRayon = 15000;
        else if (filterType === 'region') currentRayon = 50000;

        return (
          distanceEnMetres(
            latitude,
            longitude,
            incident.latitude,
            incident.longitude,
          ) <= currentRayon
        );
      })
      .map((incident) => ({
        id: incident.id,
        type:
          incident.type === 'INONDATION'
            ? 'inondation'
            : incident.type === 'QUALITE_ROUTE'
              ? 'travaux'
              : incident.type === 'ROUTE_ENDOMMAGEE'
                ? 'endomage'
                : 'accident',
        description: incident.description || '',
        latitude: incident.latitude || 0,
        longitude: incident.longitude || 0,
        id_utilisateur_createur: incident.idRapporteur,
        statut: incident.statut as IncidentStatut,
        nombreConfirmations: incident.nombreConfirmations,
        confirmePar: incident.confirmePar,
        dateCreation: incident.horodatage.toISOString(),
        dateExpiration: incident.dateExpiration?.toISOString() || '',
        imageUrl: incident.imageUrl || undefined,
        quartier: incident.quartier || undefined,
        ville: incident.ville || undefined,
        region: incident.region || undefined,
      }));
  }

  async resoudreIncident(incidentId: string): Promise<void> {
    await this.prisma.incident.update({
      where: { id: incidentId },
      data: { statut: 'resolu' },
    });
  }
}
