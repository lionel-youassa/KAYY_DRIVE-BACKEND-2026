import { Injectable } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

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
  constructor(private readonly firebase: FirebaseService) {}

  async enregistrerRelevé(data: {
    latitude: number;
    longitude: number;
    vitesseMoyenne: number;
    id_utilisateur: string;
  }): Promise<RelevéTrafic> {
    if (!this.firebase.db) {
      console.warn(
        '⚠️ Firebase non initialisé - relevé de trafic non enregistré',
      );
      return {
        ...data,
        niveau: niveauDepuisVitesse(data.vitesseMoyenne),
        timestamp: new Date().toISOString(),
        id: 'simulated-id',
      };
    }

    const relevé: RelevéTrafic = {
      ...data,
      niveau: niveauDepuisVitesse(data.vitesseMoyenne),
      timestamp: new Date().toISOString(),
    };

    const docRef = await this.firebase.db.collection('trafic').add(relevé);
    return { ...relevé, id: docRef.id };
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
    if (!this.firebase.db) {
      console.warn('⚠️ Firebase non initialisé - retour de trafic simulé');
      return { niveau: 'fluide', vitesseMoyenne: 0, nombreReleves: 0 };
    }

    const ilYa15Minutes = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const snapshot = await this.firebase.db
      .collection('trafic')
      .where('timestamp', '>', ilYa15Minutes)
      .get();

    const relevésProches = snapshot.docs
      .map(
        (doc: FirebaseFirestore.QueryDocumentSnapshot) =>
          doc.data() as RelevéTrafic,
      )
      .filter(
        (r: RelevéTrafic) =>
          distanceEnMetres(latitude, longitude, r.latitude, r.longitude) <=
            rayonMetres && typeof r.vitesseMoyenne === 'number',
      );

    if (relevésProches.length === 0) {
      return { niveau: 'fluide', vitesseMoyenne: 0, nombreReleves: 0 };
    }

    const vitesseMoyenne =
      relevésProches.reduce(
        (sum: number, r: RelevéTrafic) => sum + r.vitesseMoyenne,
        0,
      ) / relevésProches.length;

    return {
      niveau: niveauDepuisVitesse(vitesseMoyenne),
      vitesseMoyenne: Math.round(vitesseMoyenne),
      nombreReleves: relevésProches.length,
    };
  }
}
