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

            return await this.prisma.publicite.create({
                data: prismaData
            });
        } catch (error) {
            console.error("Erreur lors de la création Prisma :", error);
            throw new HttpException(
                "Impossible de créer la publicité",
                HttpStatus.BAD_REQUEST
            );
        }
    }

    // 2. Récupérer toutes les publicités (Garantit un tableau [] même si c'est vide)
    async getAllAdvertising() {
        try {
            const ads = await this.prisma.publicite.findMany();
            return ads || [];
        } catch (error) {
            console.error("Erreur lors de la récupération Prisma :", error);
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
            console.error("Erreur lors de la suppression Prisma :", error);
            throw new HttpException(
                "Impossible de supprimer la publicité",
                HttpStatus.NOT_FOUND
            );
        }
    }
}