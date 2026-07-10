import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdsService {
  constructor(private prisma: PrismaService) {}

  // 1. Créer une publicité dans PostgreSQL
  async createAdvertising(data: any) {
    try {
      // 🔴 CORRECTION : On extrait 'mediaPath' pour ne pas l'envoyer à Prisma
      // 'prismaData' contiendra le reste (titre, type, dateDebut, dateFin, etc.)
      const { mediaPath, ...prismaData } = data;

      const formattedData = {
        ...prismaData,
        dateDebut: prismaData.dateDebut
          ? new Date(prismaData.dateDebut)
          : new Date(),
        dateFin: prismaData.dateFin ? new Date(prismaData.dateFin) : new Date(),
      };

      return await this.prisma.publicite.create({
        data: formattedData,
      });
    } catch (error) {
      console.error('Erreur lors de la création Prisma :', error);
      throw new HttpException(
        'Impossible de créer la publicité',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 2. Récupérer toutes les publicités (Garantit un tableau [] même si c'est vide)
  async getAllAdvertising() {
    try {
      const ads = await this.prisma.publicite.findMany();
      return ads || [];
    } catch (error) {
      console.error('Erreur lors de la récupération Prisma :', error);
      return []; // Renvoie un tableau vide plutôt que de faire planter Flutter
    }
  }

  // 3. Supprimer une publicité par son ID
  async deleteAdvertising(id: string) {
    try {
      return await this.prisma.publicite.delete({
        where: { id },
      });
    } catch (error) {
      console.error('Erreur lors de la suppression Prisma :', error);
      throw new HttpException(
        'Impossible de supprimer la publicité',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // 4. Récupérer uniquement les publicités actives
  async getActiveAds() {
    try {
      const now = new Date();
      const ads = await this.prisma.publicite.findMany({
        where: {
          actif: true,
          dateDebut: {
            lte: now,
          },
          dateFin: {
            gte: now,
          },
        },
      });
      return ads || [];
    } catch (error) {
      console.error('Erreur lors de la récupération des pubs actives Prisma :', error);
      return [];
    }
  }
}
