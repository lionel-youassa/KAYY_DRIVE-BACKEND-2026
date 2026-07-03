import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecousseData, SAFE_DRIVE_QUEUE } from './safe-drive.service';

// Seuil au-delà duquel on considère qu'il y a un évènement anormal
// (à calibrer selon vos vrais capteurs/tests terrain)
const SEUIL_INTENSITE_ANORMALE = 15;

// ---------------------------------------------------------------------------
// SafeDriveProcessor : tourne DANS le même processus Nest (contrairement à
// l'ancien scripts/start-worker.ts qu'il fallait lancer séparément).
// NestJS le démarre automatiquement avec le reste de l'application.
// ---------------------------------------------------------------------------

@Processor(SAFE_DRIVE_QUEUE, { concurrency: 5 })
export class SafeDriveProcessor extends WorkerHost {
  private readonly logger = new Logger(SafeDriveProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SecousseData>): Promise<{ traite: boolean }> {
    const { id_utilisateur, latitude, longitude, intensite, timestamp } =
      job.data;

    // 1. Enregistrement systématique de la lecture brute
    await this.prisma.secousseData.create({
      data: {
        id_utilisateur,
        latitude,
        longitude,
        intensite,
        timestamp: new Date(timestamp),
        traite: true,
      },
    });

    // 2. Création d'un incident si l'intensité dépasse le seuil
    if (intensite >= SEUIL_INTENSITE_ANORMALE) {
      await this.prisma.incident.create({
        data: {
          type: 'TRAFIC',
          description: `Secousse anormale détectée (intensité: ${intensite})`,
          latitude,
          longitude,
          idRapporteur: id_utilisateur,
          id_utilisateur_createur: id_utilisateur,
          statut: 'non_confirme',
          nombreConfirmations: 1,
          confirmePar: [id_utilisateur],
          horodatage: new Date(),
          dateExpiration: new Date(Date.now() + 3 * 60 * 60 * 1000),
          detecteAuto: true,
        },
      });
    }

    this.logger.log(`Job ${job.id} traité`);
    return { traite: true };
  }
}
