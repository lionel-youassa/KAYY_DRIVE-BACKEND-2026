import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

export interface PointGPS {
  latitude: number;
  longitude: number;
}

export interface RaccourciCommunautaire {
  id?: string;
  nom: string;
  description: string;
  pointDepart: PointGPS;
  pointArrivee: PointGPS;
  trace: PointGPS[];
  id_utilisateur_createur: string;
  votesPositifs: number;
  votesNegatifs: number;
  votants: Record<string, 'positif' | 'negatif'>;
  scoreFiabilite: number;
  statut: 'propose' | 'valide' | 'rejete';
  dateCreation: string;
}

const SEUIL_VOTES_VALIDATION = 5;
const SEUIL_SCORE_VALIDATION = 0.7;
const SEUIL_SCORE_REJET = 0.3;

function distanceEnMetres(a: PointGPS, b: PointGPS): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

@Injectable()
export class RoutesService {
  constructor(private readonly firebase: FirebaseService) {}

  // -------------------------------------------------------------------------
  // 9.1 : Création d'une suggestion de raccourci
  // -------------------------------------------------------------------------
  async createRaccourci(data: {
    nom: string;
    description: string;
    pointDepart: PointGPS;
    pointArrivee: PointGPS;
    trace: PointGPS[];
    id_utilisateur_createur: string;
  }): Promise<RaccourciCommunautaire> {
    const raccourci: RaccourciCommunautaire = {
      ...data,
      votesPositifs: 0,
      votesNegatifs: 0,
      votants: {},
      scoreFiabilite: 0,
      statut: 'propose',
      dateCreation: new Date().toISOString(),
    };

    const docRef = await this.firebase.db.collection('routes').add(raccourci);
    return { ...raccourci, id: docRef.id };
  }

  // -------------------------------------------------------------------------
  // Vote communautaire
  // -------------------------------------------------------------------------
  async voterRaccourci(
    raccourciId: string,
    uid: string,
    vote: 'positif' | 'negatif',
  ): Promise<{ message: string; raccourci: RaccourciCommunautaire }> {
    const docRef = this.firebase.db.collection('routes').doc(raccourciId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException('Raccourci introuvable');
    }

    const raccourci = doc.data() as RaccourciCommunautaire;
    const votants = { ...raccourci.votants };
    const ancienVote = votants[uid];

    let votesPositifs = raccourci.votesPositifs;
    let votesNegatifs = raccourci.votesNegatifs;

    if (ancienVote === 'positif') votesPositifs--;
    if (ancienVote === 'negatif') votesNegatifs--;
    if (vote === 'positif') votesPositifs++;
    if (vote === 'negatif') votesNegatifs++;

    votants[uid] = vote;

    const totalVotes = votesPositifs + votesNegatifs;
    const scoreFiabilite = totalVotes > 0 ? votesPositifs / totalVotes : 0;

    let statut = raccourci.statut;
    if (totalVotes >= SEUIL_VOTES_VALIDATION) {
      if (scoreFiabilite >= SEUIL_SCORE_VALIDATION) statut = 'valide';
      else if (scoreFiabilite <= SEUIL_SCORE_REJET) statut = 'rejete';
    }

    await docRef.update({ votants, votesPositifs, votesNegatifs, scoreFiabilite, statut });

    return {
      message: 'Vote enregistré',
      raccourci: {
        ...raccourci,
        votants,
        votesPositifs,
        votesNegatifs,
        scoreFiabilite,
        statut,
        id: raccourciId,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Suggestions pour un trajet donné
  // -------------------------------------------------------------------------
  async suggererRaccourcis(
    depart: PointGPS,
    arrivee: PointGPS,
    rayonMetres = 1000,
  ): Promise<RaccourciCommunautaire[]> {
    const snapshot = await this.firebase.db
      .collection('routes')
      .where('statut', '==', 'valide')
      .get();

    const raccourcis = snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
      ...(doc.data() as RaccourciCommunautaire),
      id: doc.id,
    }));

    return raccourcis.filter(
      (r: RaccourciCommunautaire) =>
        distanceEnMetres(depart, r.pointDepart) <= rayonMetres &&
        distanceEnMetres(arrivee, r.pointArrivee) <= rayonMetres,
    );
  }
}
