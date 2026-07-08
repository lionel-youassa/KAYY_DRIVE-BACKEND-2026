import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type NiveauTrafic = 'fluide' | 'dense' | 'bouchon';

export interface RelevéTrafic {
  id?: string;
  latitude: number;
  longitude: number;
  vitesseMoyenne: number;
  niveau: NiveauTrafic;
  id_utilisateur: string;
  timestamp: string;
}

export function niveauDepuisVitesse(vitesseKmh: number): NiveauTrafic {
  if (vitesseKmh >= 30) return 'fluide';
  if (vitesseKmh >= 10) return 'dense';
  return 'bouchon';
}

function distanceEnMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class TraficService {
  constructor(private readonly prisma: PrismaService) {}

  async enregistrerRelevé(data: {
    latitude: number;
    longitude: number;
    vitesseMoyenne: number;
    id_utilisateur: string;
  }): Promise<RelevéTrafic> {
    const niveau = niveauDepuisVitesse(data.vitesseMoyenne);

    const relevé = await this.prisma.releveTrafic.create({
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
        vitesseMoyenne: data.vitesseMoyenne,
        niveau: niveau,
        id_utilisateur: data.id_utilisateur,
      },
    });

    return {
      id: relevé.id,
      latitude: relevé.latitude,
      longitude: relevé.longitude,
      vitesseMoyenne: relevé.vitesseMoyenne,
      niveau: relevé.niveau as NiveauTrafic,
      id_utilisateur: relevé.id_utilisateur,
      timestamp: relevé.timestamp.toISOString(),
    };
  }

  async getTraficActuel(
    latitude: number,
    longitude: number,
    rayonMetres = 1000,
  ): Promise<{
    niveau: NiveauTrafic;
    vitesseMoyenne: number;
    nombreReleves: number;
  }> {
    const ilYa15Minutes = new Date(Date.now() - 15 * 60 * 1000);

    const relevés = await this.prisma.releveTrafic.findMany({
      where: {
        timestamp: {
          gte: ilYa15Minutes,
        },
      },
    });

    const relevésProches = relevés.filter(
      (r) =>
        distanceEnMetres(latitude, longitude, r.latitude, r.longitude) <=
          rayonMetres && typeof r.vitesseMoyenne === 'number',
    );

    if (relevésProches.length === 0) {
      return { niveau: 'fluide', vitesseMoyenne: 0, nombreReleves: 0 };
    }

    const vitesseMoyenne =
      relevésProches.reduce((sum: number, r) => sum + r.vitesseMoyenne, 0) /
      relevésProches.length;

    return {
      niveau: niveauDepuisVitesse(vitesseMoyenne),
      vitesseMoyenne: Math.round(vitesseMoyenne),
      nombreReleves: relevésProches.length,
    };
  }
}
