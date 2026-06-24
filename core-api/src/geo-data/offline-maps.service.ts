import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class OfflineMapsService {
    private prisma = new PrismaClient();
    // Emplacement théorique où Aisha va stocker les cartes téléchargées sur le serveur
    private readonly storagePath = join(__dirname, '..', '..', 'storage', 'mbtiles');

    constructor() {}

    /**
     * Récupère les métadonnées et la taille du fichier MBTiles d'une ville spécifiée
     */
    async getMapMetadata(ville: string) {
        const nomVille = ville.toLowerCase().trim();
        if (nomVille !== 'douala' && nomVille !== 'yaounde') {
            throw new BadRequestException("Seules les cartes de 'douala' et 'yaounde' sont disponibles.");
        }

        // Simulation/Vérification de l'existence du fichier binaire sur le serveur
        const filename = `${nomVille}.mbtiles`;
        const filepath = join(this.storagePath, filename);
        const estDisponibleSurServeur = existsSync(filepath);

        // Retourne les informations nécessaires à Aisha pour son endpoint de téléchargement
        return {
            ville: nomVille === 'douala' ? 'Douala' : 'Yaoundé',
            code: nomVille,
            format: 'MBTiles',
            tailleEstimee: nomVille === 'douala' ? '45 MB' : '38 MB',
            derniereMiseAJour: new Date(),
            statutDisponibilite: estDisponibleSurServeur ? 'READY' : 'GENERATING_ON_DEMAND',
            pathServeur: filepath
        };
    }

    /**
     * Enregistre dans le profil utilisateur que le mode hors-ligne est actif
     */
    async activeOfflineModeForUser(utilisateurId: string): Promise<boolean> {
        try {
            await this.prisma.preferencesUtilisateur.update({
                where: { utilisateurId },
                data: { modeHorsLigneActif: true },
            });
            return true;
        } catch (error) {
            throw new NotFoundException("Impossible de trouver les préférences pour cet utilisateur.");
        }
    }
}