import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AdType = 'video' | 'image' | 'banner' | 'interstitial' | 'popup';

/** Types canoniques acceptés (minuscules, sans accent). */
const ALLOWED_TYPES: AdType[] = [
  'video',
  'image',
  'banner',
  'interstitial',
  'popup',
];

/** Normalise "Vidéo"/"Bannière"/"BANNER " -> "video"/"banner". */
export function normalizeAdType(raw: unknown): AdType {
  const v = (typeof raw === 'string' ? raw : '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if ((ALLOWED_TYPES as string[]).includes(v)) return v as AdType;
  // Alias historiques
  if (v === 'banniere') return 'banner';
  if (v === 'vid') return 'video';
  throw new HttpException(
    `Type de publicité invalide: "${String(raw)}". Attendu: ${ALLOWED_TYPES.join(', ')}`,
    HttpStatus.BAD_REQUEST,
  );
}

@Injectable()
export class AdsService {
  constructor(private prisma: PrismaService) {}

  // 1. Créer une publicité (admin uniquement — garde au niveau controller).
  async createAdvertising(data: any) {
    try {
      const { mediaPath, vues, clics, ...rest } = data ?? {};

      const titre = String(rest.titre ?? '').trim();
      if (!titre) {
        throw new HttpException(
          'Le titre est obligatoire',
          HttpStatus.BAD_REQUEST,
        );
      }
      const type = normalizeAdType(rest.type ?? 'banner');

      const dateDebut = rest.dateDebut ? new Date(rest.dateDebut) : new Date();
      const dateFin = rest.dateFin ? new Date(rest.dateFin) : new Date();
      if (isNaN(dateDebut.getTime()) || isNaN(dateFin.getTime())) {
        throw new HttpException(
          'Dates invalides (ISO 8601 attendu)',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (dateFin < dateDebut) {
        throw new HttpException(
          'dateFin doit être postérieure à dateDebut',
          HttpStatus.BAD_REQUEST,
        );
      }

      // L'admin choisit l'état (défaut: actif immédiat).
      const actif = rest.actif !== false;

      return await this.prisma.publicite.create({
        data: {
          titre,
          description: rest.description ?? null,
          type,
          dateDebut,
          dateFin,
          actif,
          imageUrl: rest.imageUrl ?? null,
        },
      });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Erreur lors de la création Prisma :', error);
      throw new HttpException(
        'Impossible de créer la publicité',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // 1b. Mise à jour / modération admin.
  async updateAdvertising(id: string, data: any) {
    try {
      const patch: any = {};
      if (data.titre !== undefined) patch.titre = String(data.titre).trim();
      if (data.description !== undefined)
        patch.description = data.description ?? null;
      if (data.type !== undefined) patch.type = normalizeAdType(data.type);
      if (data.dateDebut !== undefined) {
        const d = new Date(data.dateDebut);
        if (isNaN(d.getTime()))
          throw new HttpException('dateDebut invalide', HttpStatus.BAD_REQUEST);
        patch.dateDebut = d;
      }
      if (data.dateFin !== undefined) {
        const d = new Date(data.dateFin);
        if (isNaN(d.getTime()))
          throw new HttpException('dateFin invalide', HttpStatus.BAD_REQUEST);
        patch.dateFin = d;
      }
      if (data.actif !== undefined) patch.actif = Boolean(data.actif);
      if (data.imageUrl !== undefined) patch.imageUrl = data.imageUrl ?? null;

      return await this.prisma.publicite.update({ where: { id }, data: patch });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Erreur lors de la mise à jour Prisma :', error);
      throw new HttpException(
        'Impossible de mettre à jour la publicité',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  // 2. Récupérer toutes les publicités (filtres optionnels, tri récent d'abord)
  async getAllAdvertising(filters?: { type?: string; actif?: boolean }) {
    try {
      const where: any = {};
      if (filters?.type) {
        try {
          where.type = normalizeAdType(filters.type);
        } catch {
          // type inconnu -> aucun résultat plutôt qu'erreur 500
          return [];
        }
      }
      if (filters?.actif !== undefined) where.actif = filters.actif;
      const ads = await this.prisma.publicite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return ads || [];
    } catch (error) {
      console.error('Erreur lors de la récupération Prisma :', error);
      return [];
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

  // 4. Récupérer uniquement les publicités actives (fenêtre de dates valide)
  async getActiveAds(type?: string, limit?: number) {
    try {
      const now = new Date();
      const where: any = {
        actif: true,
        dateDebut: { lte: now },
        dateFin: { gte: now },
      };
      if (type) {
        try {
          where.type = normalizeAdType(type);
        } catch {
          return [];
        }
      }
      const ads = await this.prisma.publicite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take:
          Number.isFinite(limit) && (limit as number) > 0
            ? Math.min(limit as number, 50)
            : undefined,
      });
      return ads || [];
    } catch (error) {
      console.error(
        'Erreur lors de la récupération des pubs actives Prisma :',
        error,
      );
      return [];
    }
  }

  // 5. Tracking : contrat stable même sans colonnes vues/clics en base.
  // TODO: ajouter vues/clics/lienCta au modèle Publicite puis incrémenter ici.
  async recordView(_id: string): Promise<void> {
    return;
  }

  async recordClick(_id: string): Promise<void> {
    return;
  }
}
