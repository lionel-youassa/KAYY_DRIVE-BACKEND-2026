import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface SecousseData {
  id_utilisateur: string;
  latitude: number;
  longitude: number;
  intensite: number;
  timestamp: string;
}

export const SAFE_DRIVE_QUEUE = 'safe-drive-secousses';

@Injectable()
export class SafeDriveService {
  constructor(
    @InjectQueue(SAFE_DRIVE_QUEUE) private readonly queue: Queue<SecousseData>,
  ) {}

  // Ajoute une lecture accéléromètre à la queue. Le traitement réel se fait
  // dans SafeDriveProcessor (voir safe-drive.processor.ts), de façon
  // asynchrone, pour ne jamais ralentir la réponse HTTP.
  async ajouterSecousse(data: SecousseData): Promise<void> {
    await this.queue.add('nouvelle-secousse', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
  }
}
