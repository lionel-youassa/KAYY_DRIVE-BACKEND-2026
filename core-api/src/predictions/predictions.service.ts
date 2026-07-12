import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NiveauTrafic, niveauDepuisVitesse } from '../trafic/trafic.service';
import { WazeRouteService } from './waze-route.service';

export interface PredictionTrafic {
  latitude: number;
  longitude: number;
  jourSemaine: number;
  heure: number;
  niveauPredit: NiveauTrafic;
  vitesseMoyennePredite: number;
  confidence: 'faible' | 'moyenne' | 'haute';
  nombreEchantillons: number;
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

function determinerConfiance(
  nombreEchantillons: number,
): 'faible' | 'moyenne' | 'haute' {
  if (nombreEchantillons >= 20) return 'haute';
  if (nombreEchantillons >= 5) return 'moyenne';
  return 'faible';
}

@Injectable()
export class PredictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wazeRouteService: WazeRouteService,
  ) {}

  async predireTraficPoint(
    latitude: number,
    longitude: number,
    dateCible: Date = new Date(),
    rayonMetres = 1000,
  ): Promise<PredictionTrafic> {
    const jourSemaine = dateCible.getDay();
    const heure = dateCible.getHours();

    const ilYa60Jours = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const relevés = await this.prisma.releveTrafic.findMany({
      where: {
        timestamp: {
          gte: ilYa60Jours,
        },
      },
    });

    const echantillonsPertinents = relevés.filter((r) => {
      if (typeof r.vitesseMoyenne !== 'number') return false;
      if (
        distanceEnMetres(latitude, longitude, r.latitude, r.longitude) >
        rayonMetres
      ) {
        return false;
      }
      const date = r.timestamp;
      return (
        date.getDay() === jourSemaine && Math.abs(date.getHours() - heure) <= 1
      );
    });

    if (echantillonsPertinents.length === 0) {
      return {
        latitude,
        longitude,
        jourSemaine,
        heure,
        niveauPredit: 'modere' as NiveauTrafic,
        vitesseMoyennePredite: 25,
        confidence: 'faible',
        nombreEchantillons: 0,
      };
    }

    const vitesseMoyennePredite =
      echantillonsPertinents.reduce(
        (sum: number, r) => sum + r.vitesseMoyenne,
        0,
      ) / echantillonsPertinents.length;

    return {
      latitude,
      longitude,
      jourSemaine,
      heure,
      niveauPredit: niveauDepuisVitesse(vitesseMoyennePredite),
      vitesseMoyennePredite: Math.round(vitesseMoyennePredite),
      confidence: determinerConfiance(echantillonsPertinents.length),
      nombreEchantillons: echantillonsPertinents.length,
    };
  }

  async predireTraficItineraire(
    points: { latitude: number; longitude: number }[],
    dateCible: Date = new Date(),
  ): Promise<PredictionTrafic[]> {
    // 1. Obtenir les prédictions historiques locales
    const predictions: PredictionTrafic[] = [];
    for (const point of points) {
      const prediction = await this.predireTraficPoint(
        point.latitude,
        point.longitude,
        dateCible,
      );
      predictions.push(prediction);
    }

    // 2. Enrichir avec les données Waze temps réel (si disponible)
    if (points.length >= 2) {
      try {
        const start = points[0];
        const end = points[points.length - 1];
        const wazeResult = await this.wazeRouteService.getRouteTraffic(
          start.latitude,
          start.longitude,
          end.latitude,
          end.longitude,
        );

        if (wazeResult.success && wazeResult.segments.length > 0) {
          // Pour chaque point de prédiction, trouver le segment Waze le plus proche
          for (const pred of predictions) {
            const closestSeg = this.wazeRouteService.findClosestSegment(
              pred.latitude,
              pred.longitude,
              wazeResult.segments,
            );

            if (closestSeg) {
              // Écraser avec la vitesse réelle Waze
              pred.vitesseMoyennePredite = Math.round(closestSeg.speedKmh);
              pred.niveauPredit = niveauDepuisVitesse(closestSeg.speedKmh);
              pred.confidence = 'haute';
            }
          }
        }
      } catch (e) {
        // Waze indisponible — on garde les prédictions historiques
        console.warn('[PredictionsService] Waze overlay échoué:', e?.message);
      }
    }

    return predictions;
  }

  async calculerComfortItineraire(
    points: { latitude: number; longitude: number }[],
  ): Promise<{
    comfortScore: number;
    comfortLevel: string;
    recommendation: string;
    hasFlood: boolean;
    hasDegraded: boolean;
  }> {
    const activeIncidents = await this.prisma.incident.findMany({
      where: {
        dateExpiration: { gt: new Date() },
        statut: { not: 'resolu' },
      },
    });

    const recentShocks = await this.prisma.secousseData.findMany({
      where: {
        intensite: { gte: 8.0 },
        timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    // Filtrer les incidents avec coordonnées valides
    const geoIncidents = activeIncidents.filter(
      (inc) => inc.latitude != null && inc.longitude != null,
    );

    let floodCount = 0;
    let degradedCount = 0;

    for (const point of points) {
      const lat = point.latitude;
      const lng = point.longitude;

      const hasFlood = geoIncidents.some(
        (inc) =>
          inc.type === 'INONDATION' &&
          distanceEnMetres(lat, lng, inc.latitude!, inc.longitude!) <= 150,
      );
      if (hasFlood) floodCount++;

      const hasDegradedIncident = geoIncidents.some(
        (inc) =>
          inc.type === 'QUALITE_ROUTE' &&
          distanceEnMetres(lat, lng, inc.latitude!, inc.longitude!) <= 150,
      );
      const hasDegradedShock = recentShocks.some(
        (shock) =>
          distanceEnMetres(lat, lng, shock.latitude, shock.longitude) <= 150,
      );

      if (hasDegradedIncident || hasDegradedShock) degradedCount++;
    }

    let comfortScore = 100 - floodCount * 40 - degradedCount * 20;
    comfortScore = Math.max(0, Math.min(100, comfortScore));

    let comfortLevel = 'excellent';
    let recommendation = 'Itinéraire sûr, aucun incident majeur détecté.';
    if (comfortScore >= 80) {
      comfortLevel = 'excellent';
      recommendation = 'Itinéraire sûr, chaussée en bon état.';
    } else if (comfortScore >= 60) {
      comfortLevel = 'bon';
      recommendation =
        'Itinéraire globalement bon, légers ralentissements ou dégradations.';
    } else if (comfortScore >= 40) {
      comfortLevel = 'moyen';
      recommendation = 'Itinéraire moyennement dégradé, soyez vigilant.';
    } else {
      comfortLevel = 'mauvais';
      recommendation =
        'Itinéraire très dégradé ou inondation détectée, évitez ce trajet si possible !';
    }

    return {
      comfortScore,
      comfortLevel,
      recommendation,
      hasFlood: floodCount > 0,
      hasDegraded: degradedCount > 0,
    };
  }
}
