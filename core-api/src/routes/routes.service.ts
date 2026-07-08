import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

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
    const raccourci = await this.prisma.raccourciCommunautaire.create({
      data: {
        nom: data.nom,
        description: data.description,
        pointDepartLat: data.pointDepart.latitude,
        pointDepartLng: data.pointDepart.longitude,
        pointArriveeLat: data.pointArrivee.latitude,
        pointArriveeLng: data.pointArrivee.longitude,
        trace: data.trace as any,
        idUtilisateurCreateur: data.id_utilisateur_createur,
        votesPositifs: 0,
        votesNegatifs: 0,
        scoreFiabilite: 0,
        statut: 'propose',
        dateCreation: new Date(),
      },
    });

    return {
      id: raccourci.id,
      nom: raccourci.nom,
      description: raccourci.description,
      pointDepart: {
        latitude: raccourci.pointDepartLat,
        longitude: raccourci.pointDepartLng,
      },
      pointArrivee: {
        latitude: raccourci.pointArriveeLat,
        longitude: raccourci.pointArriveeLng,
      },
      trace: raccourci.trace as unknown as PointGPS[],
      id_utilisateur_createur: raccourci.idUtilisateurCreateur,
      votesPositifs: raccourci.votesPositifs,
      votesNegatifs: raccourci.votesNegatifs,
      votants: {},
      scoreFiabilite: raccourci.scoreFiabilite,
      statut: raccourci.statut as 'propose' | 'valide' | 'rejete',
      dateCreation: raccourci.dateCreation.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Vote communautaire
  // -------------------------------------------------------------------------
  async voterRaccourci(
    raccourciId: string,
    uid: string,
    vote: 'positif' | 'negatif',
  ): Promise<{ message: string; raccourci: RaccourciCommunautaire }> {
    const raccourci = await this.prisma.raccourciCommunautaire.findUnique({
      where: { id: raccourciId },
      include: { votes: true },
    });

    if (!raccourci) {
      throw new NotFoundException('Raccourci introuvable');
    }

    const ancienVote = raccourci.votes.find(
      (v) => v.utilisateurId === uid,
    )?.vote;

    let votesPositifs = raccourci.votesPositifs;
    let votesNegatifs = raccourci.votesNegatifs;

    if (ancienVote === 'positif') votesPositifs--;
    if (ancienVote === 'negatif') votesNegatifs--;

    if (vote === 'positif') votesPositifs++;
    if (vote === 'negatif') votesNegatifs++;

    const totalVotes = votesPositifs + votesNegatifs;
    const scoreFiabilite = totalVotes > 0 ? votesPositifs / totalVotes : 0;

    let statut = raccourci.statut;
    if (totalVotes >= SEUIL_VOTES_VALIDATION) {
      if (scoreFiabilite >= SEUIL_SCORE_VALIDATION) statut = 'valide';
      else if (scoreFiabilite <= SEUIL_SCORE_REJET) statut = 'rejete';
    }

    await this.prisma.voteRaccourci.upsert({
      where: {
        raccourciId_utilisateurId: {
          raccourciId,
          utilisateurId: uid,
        },
      },
      update: { vote },
      create: {
        raccourciId,
        utilisateurId: uid,
        vote,
      },
    });

    const updated = await this.prisma.raccourciCommunautaire.update({
      where: { id: raccourciId },
      data: {
        votesPositifs,
        votesNegatifs,
        scoreFiabilite,
        statut,
      },
    });

    return {
      message: 'Vote enregistré',
      raccourci: {
        id: updated.id,
        nom: updated.nom,
        description: updated.description,
        pointDepart: {
          latitude: updated.pointDepartLat,
          longitude: updated.pointDepartLng,
        },
        pointArrivee: {
          latitude: updated.pointArriveeLat,
          longitude: updated.pointArriveeLng,
        },
        trace: updated.trace as unknown as PointGPS[],
        id_utilisateur_createur: updated.idUtilisateurCreateur,
        votesPositifs: updated.votesPositifs,
        votesNegatifs: updated.votesNegatifs,
        votants: {},
        scoreFiabilite: updated.scoreFiabilite,
        statut: updated.statut as 'propose' | 'valide' | 'rejete',
        dateCreation: updated.dateCreation.toISOString(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Récupérer tous les raccourcis
  // -------------------------------------------------------------------------
  async getAllRaccourcis(): Promise<RaccourciCommunautaire[]> {
    const raccourcis = await this.prisma.raccourciCommunautaire.findMany({
      where: { statut: 'valide' },
    });

    return raccourcis.map((r) => ({
      id: r.id,
      nom: r.nom,
      description: r.description,
      pointDepart: {
        latitude: r.pointDepartLat,
        longitude: r.pointDepartLng,
      },
      pointArrivee: {
        latitude: r.pointArriveeLat,
        longitude: r.pointArriveeLng,
      },
      trace: r.trace as unknown as PointGPS[],
      id_utilisateur_createur: r.idUtilisateurCreateur,
      votesPositifs: r.votesPositifs,
      votesNegatifs: r.votesNegatifs,
      votants: {},
      scoreFiabilite: r.scoreFiabilite,
      statut: r.statut as 'propose' | 'valide' | 'rejete',
      dateCreation: r.dateCreation.toISOString(),
    }));
  }

  // -------------------------------------------------------------------------
  // Suggestions pour un trajet donné
  // -------------------------------------------------------------------------
  async suggererRaccourcis(
    depart: PointGPS,
    arrivee: PointGPS,
    rayonMetres = 1000,
  ): Promise<RaccourciCommunautaire[]> {
    const raccourcis = await this.prisma.raccourciCommunautaire.findMany({
      where: { statut: 'valide' },
    });

    return raccourcis
      .filter(
        (r) =>
          distanceEnMetres(depart, {
            latitude: r.pointDepartLat,
            longitude: r.pointDepartLng,
          }) <= rayonMetres &&
          distanceEnMetres(arrivee, {
            latitude: r.pointArriveeLat,
            longitude: r.pointArriveeLng,
          }) <= rayonMetres,
      )
      .map((r) => ({
        id: r.id,
        nom: r.nom,
        description: r.description,
        pointDepart: {
          latitude: r.pointDepartLat,
          longitude: r.pointDepartLng,
        },
        pointArrivee: {
          latitude: r.pointArriveeLat,
          longitude: r.pointArriveeLng,
        },
        trace: r.trace as unknown as PointGPS[],
        id_utilisateur_createur: r.idUtilisateurCreateur,
        votesPositifs: r.votesPositifs,
        votesNegatifs: r.votesNegatifs,
        votants: {},
        scoreFiabilite: r.scoreFiabilite,
        statut: r.statut as 'propose' | 'valide' | 'rejete',
        dateCreation: r.dateCreation.toISOString(),
      }));
  }
}
