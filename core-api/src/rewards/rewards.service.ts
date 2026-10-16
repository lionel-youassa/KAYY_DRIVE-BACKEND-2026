import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RewardsService {
    constructor(private readonly prisma: PrismaService) {}

    async getCatalog() {
        return this.prisma.recompense.findMany({
            where: {
                actif: true,
                dateFin: { gte: new Date() },
            },
            orderBy: { points: 'asc' },
        });
    }

    async getUserPoints(utilisateurId: string) {
        const historique = await this.prisma.historiquePoints.findMany({
            where: { utilisateurId },
            orderBy: { date: 'desc' },
        });

        const totalPoints = historique.reduce((sum, item) => sum + item.points, 0);

        return {
            points: Math.max(0, totalPoints),
            historique,
        };
    }

    async getMyRewards(utilisateurId: string) {
        return this.prisma.recompenseUtilisateur.findMany({
            where: { utilisateurId },
            include: { recompense: true },
            orderBy: { dateObtention: 'desc' },
        });
    }

    async claimReward(utilisateurId: string, recompenseId: string) {
        const recompense = await this.prisma.recompense.findUnique({
            where: { id: recompenseId },
        });

        if (!recompense || !recompense.actif || new Date() > recompense.dateFin) {
            throw new NotFoundException('Récompense indisponible ou expirée.');
        }

        const { points: soldeActuel } = await this.getUserPoints(utilisateurId);

        if (soldeActuel < recompense.points) {
            throw new BadRequestException('Solde de points insuffisant.');
        }

        const prefixe = (recompense.type || 'REWARD').substring(0, 4).toUpperCase();
        const randomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        const codePromo = `KAYY-${prefixe}-${randomCode}`;

        return this.prisma.$transaction(async (tx) => {
            await tx.historiquePoints.create({
                data: {
                    utilisateurId,
                    points: -recompense.points,
                    motif: `Déblocage offre : ${recompense.titre}`,
                },
            });

            return tx.recompenseUtilisateur.create({
                data: {
                    utilisateurId,
                    recompenseId,
                    codePromo,
                    dateExpiration: recompense.dateFin,
                },
                include: { recompense: true },
            });
        });
    }

    async creditPoints(utilisateurId: string, points: number, motif: string) {
        return this.prisma.historiquePoints.create({
            data: {
                utilisateurId,
                points,
                motif,
            },
        });
    }

    async createReward(data: {
        titre: string;
        description?: string;
        points: number;
        type: string;
        partenaire?: string;
        valeur?: string;
        dateDebut: string | Date;
        dateFin: string | Date;
        imageUrl?: string;
    }) {
        return this.prisma.recompense.create({
            data: {
                titre: data.titre,
                description: data.description,
                points: Number(data.points),
                type: data.type,
                partenaire: data.partenaire ?? 'KAYY Partner',
                valeur: data.valeur,
                dateDebut: new Date(data.dateDebut),
                dateFin: new Date(data.dateFin),
                imageUrl: data.imageUrl,
            },
        });
    }

    async deleteReward(id: string) {
        return this.prisma.recompense.delete({
            where: { id },
        });
    }
}