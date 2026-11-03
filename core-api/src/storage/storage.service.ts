import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private bucketName: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    const endPoint = this.configService.get<string>('MINIO_ENDPOINT')?.trim();
    const invalidOnRender =
      process.env.RENDER === 'true' &&
      (endPoint === 'localhost' || endPoint === '127.0.0.1');
    this.enabled = Boolean(endPoint) && !invalidOnRender;

    this.minioClient = new Minio.Client({
      endPoint: endPoint || 'localhost',
      port: parseInt(this.configService.get('MINIO_PORT') || '9000'),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: this.configService.get('MINIO_SECRET_KEY') || 'minioadmin123',
    });
    this.bucketName = this.configService.get('MINIO_BUCKET') || 'kayydrive';
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn(
        'MinIO non configuré (MINIO_ENDPOINT absent ou localhost sur Render) : stockage désactivé, les uploads renverront 503.',
      );
      return;
    }

    try {
      const bucketExists = await this.minioClient.bucketExists(this.bucketName);
      if (!bucketExists) {
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Bucket ${this.bucketName} créé avec succès`);
      }

      // Configuration de la politique de lecture publique (Lecture seule anonyme)
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/*`],
          },
        ],
      };

      await this.minioClient.setBucketPolicy(
        this.bucketName,
        JSON.stringify(policy),
      );
      this.logger.log(
        `Politique de lecture publique appliquée au bucket ${this.bucketName}`,
      );
    } catch (error) {
      const details =
        error?.message ||
        error?.code ||
        (error instanceof Error ? error.name : String(error));
      this.logger.error(
        `Erreur lors de l'initialisation du bucket: ${details}`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    if (!this.enabled) {
      throw new ServiceUnavailableException(
        "Le service de stockage n'est pas configuré.",
      );
    }

    const fileName = `${folder}/${Date.now()}-${file.originalname}`;

    try {
      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
        },
      );
    } catch (error) {
      const details =
        error?.message ||
        error?.code ||
        (error instanceof Error ? error.name : String(error));
      this.logger.error(`Erreur lors de l'upload du fichier: ${details}`);
      throw new ServiceUnavailableException(
        'Le service de stockage est indisponible.',
      );
    }

    return this.getFileUrl(fileName);
  }

  async deleteFile(objectName: string): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.minioClient.removeObject(this.bucketName, objectName);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression du fichier: ${error.message}`,
      );
    }
  }

  getFileUrl(objectName: string): string {
    const publicUrl = this.configService.get<string>('MINIO_PUBLIC_URL');

    if (publicUrl && publicUrl.trim() !== '') {
      return `${publicUrl.trim().replace(/\/+$/, '')}/${this.bucketName}/${objectName}`;
    }

    let endPoint = this.configService.get('MINIO_ENDPOINT') || 'localhost';
    if (endPoint === 'minio') {
      endPoint = 'localhost';
    }
    const port = this.configService.get('MINIO_PORT') || '9000';
    const useSSL = this.configService.get('MINIO_USE_SSL') === 'true';

    return `${useSSL ? 'https' : 'http'}://${endPoint}:${port}/${this.bucketName}/${objectName}`;
  }

  extractObjectName(url: string): string {
    const parts = url.split(`/${this.bucketName}/`);
    return parts.length > 1 ? parts[1] : '';
  }
}
