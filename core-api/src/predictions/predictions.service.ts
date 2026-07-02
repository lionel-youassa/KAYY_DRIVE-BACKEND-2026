import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { NiveauTrafic, niveauDepuisVitesse } from '../trafic/trafic.service';

export interface PredictionTrafic {
  latitude: number;
  longitude: number;
  jourSemaine: number;
  heure: number;
  niveauPredit: NiveauTrafic;
  vitesseMoyennePredite: number;
  confiance: 'faible' | 'moyenne' | 'haute';
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
  constructor(private readonly firebase: FirebaseService) {}

  async predireTraficPoint(
    latitude: number,
    longitude: number,
    dateCible: Date = new Date(),
    rayonMetres = 1000,
  ): Promise<PredictionTrafic> {
    const jourSemaine = dateCible.getDay();
    const heure = dateCible.getHours();

    if (!this.firebase.db) {
      console.warn(
        '⚠️ Firebase non initialisé - retour de prediction par défaut',
      );
      return {
        latitude,
        longitude,
        jourSemaine,
        heure,
        niveauPredit: 'fluide',
        vitesseMoyennePredite: 0,
        confiance: 'faible',
        nombreEchantillons: 0,
      };
    }

    const ilYa60Jours = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const snapshot = await this.firebase.db
      .collection('trafic')
      .where('timestamp', '>', ilYa60Jours)
      .get();

    const echantillonsPertinents = snapshot.docs
      .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data())
      .filter((r: any) => {
        if (typeof r.vitesseMoyenne !== 'number') return false;
        if (
          distanceEnMetres(latitude, longitude, r.latitude, r.longitude) >
          rayonMetres
        ) {
          return false;
        }
        const date = new Date(r.timestamp);
        return (
          date.getDay() === jourSemaine &&
          Math.abs(date.getHours() - heure) <= 1
        );
      });

    if (echantillonsPertinents.length === 0) {
      return {
        latitude,
        longitude,
        jourSemaine,
        heure,
        niveauPredit: 'fluide',
        vitesseMoyennePredite: 0,
        confiance: 'faible',
        nombreEchantillons: 0,
      };
    }

    const vitesseMoyennePredite =
      echantillonsPertinents.reduce(
        (sum: number, r: any) => sum + r.vitesseMoyenne,
        0,
      ) / echantillonsPertinents.length;

    return {
      latitude,
      longitude,
      jourSemaine,
      heure,
      niveauPredit: niveauDepuisVitesse(vitesseMoyennePredite),
      vitesseMoyennePredite: Math.round(vitesseMoyennePredite),
      confiance: determinerConfiance(echantillonsPertinents.length),
      nombreEchantillons: echantillonsPertinents.length,
    };
  }

  async predireTraficItineraire(
    points: { latitude: number; longitude: number }[],
    dateCible: Date = new Date(),
  ): Promise<PredictionTrafic[]> {
    const predictions: PredictionTrafic[] = [];

    for (const point of points) {
      const prediction = await this.predireTraficPoint(
        point.latitude,
        point.longitude,
        dateCible,
      );
      predictions.push(prediction);
    }

    return predictions;
  }
}
