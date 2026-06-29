import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RewardsService {
    constructor(private prisma: PrismaService) {}

    // 1. Créer une récompense dans PostgreSQL
    async createReward(data: any) {
        try {
            return await this.prisma.recompense.create({
                data: data
            });
        } catch (error) {
            console.error("Erreur lors de la création de la récompense Prisma :", error);
            throw new HttpException(
                "Impossible de créer la récompense",
                HttpStatus.BAD_REQUEST
            );
        }
    }

    // 2. Récupérer toutes les récompenses (Garantit un tableau [] même si c'est vide)
    async getAllRewards() {
        try {
            const rewards = await this.prisma.recompense.findMany();
            return rewards || [];
        } catch (error) {
            console.error("Erreur lors de la récupération des récompenses Prisma :", error);
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
            console.error("Erreur lors de la suppression de la récompense Prisma :", error);
            throw new HttpException(
                "Impossible de supprimer la récompense",
                HttpStatus.NOT_FOUND
            );
        }
    }
}