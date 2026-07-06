import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  // 1. Créer une récompense dans PostgreSQL
  async createReward(data: any) {
    try {
      const formattedData = {
        ...data,
        points: data.points ? parseInt(data.points, 10) : 0,
        participationMin: data.participationMin ? parseInt(data.participationMin, 10) : 0,
        dateDebut: data.dateDebut ? new Date(data.dateDebut) : new Date(),
        dateFin: data.dateFin ? new Date(data.dateFin) : new Date(),
      };

      return await this.prisma.recompense.create({
        data: formattedData,
      });
    } catch (error) {
      console.error(
        'Erreur lors de la création de la récompense Prisma :',
        error,
      );
      throw new HttpException(
        'Impossible de créer la récompense',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 2. Récupérer toutes les récompenses (Garantit un tableau [] même si c'est vide)
  async getAllRewards() {
    try {
      const rewards = await this.prisma.recompense.findMany();
      return rewards || [];
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des récompenses Prisma :',
        error,
      );
      return []; // Renvoie un tableau vide plutôt que de faire planter Flutter
    }
  }

  // 3. Supprimer une récompense par son ID
  async deleteReward(id: string) {
    try {
      return await this.prisma.recompense.delete({
        where: { id },
      });
    } catch (error) {
      console.error(
        'Erreur lors de la suppression de la récompense Prisma :',
        error,
      );
      throw new HttpException(
        'Impossible de supprimer la récompense',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // 4. Calculer le score de participation d'un utilisateur
  // Participation = nombre d'incidents signalés + nombre de confirmations effectuées
  async getParticipationScore(userId: string): Promise<number> {
    try {
      // Incidents signalés par l'utilisateur
      const signalesCount = await this.prisma.incident.count({
        where: { idRapporteur: userId },
      });

      // Incidents confirmés par l'utilisateur (dans le tableau confirmePar)
      const confirmedIncidents = await this.prisma.incident.findMany({
        select: { confirmePar: true },
      });
      const confirmationsCount = confirmedIncidents.filter((inc) =>
        inc.confirmePar.includes(userId),
      ).length;

      return signalesCount + confirmationsCount;
    } catch (error) {
      console.error('Erreur calcul score participation:', error);
      return 0;
    }
  }

  // 5. Vérifier l'éligibilité d'un utilisateur aux récompenses
  async getEligibility(userId: string) {
    try {
      const participationScore = await this.getParticipationScore(userId);
      const allRewards = await this.prisma.recompense.findMany({
        where: { actif: true },
      });

      const eligibleRewards = allRewards.filter(
        (r) => participationScore >= r.participationMin,
      );

      return {
        participationScore,
        eligibleRewards,
        totalRewards: allRewards.length,
      };
    } catch (error) {
      console.error('Erreur vérification éligibilité:', error);
      return { participationScore: 0, eligibleRewards: [], totalRewards: 0 };
    }
  }
}
