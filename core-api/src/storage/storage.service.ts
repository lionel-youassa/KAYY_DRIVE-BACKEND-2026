import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT') || 'localhost',
      port: parseInt(this.configService.get('MINIO_PORT') || '9000'),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY') || 'minioadmin',
      secretKey: this.configService.get('MINIO_SECRET_KEY') || 'minioadmin123',
    });
    this.bucketName = this.configService.get('MINIO_BUCKET') || 'kayydrive';
  }

  async onModuleInit() {
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
      this.logger.log(`Politique de lecture publique appliquée au bucket ${this.bucketName}`);
    } catch (error) {
      this.logger.error(
        `Erreur lors de l'initialisation du bucket: ${error.message}`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<string> {
    const fileName = `${folder}/${Date.now()}-${file.originalname}`;

    await this.minioClient.putObject(
      this.bucketName,
      fileName,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
      },
    );

    return this.getFileUrl(fileName);
  }

  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, objectName);
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression du fichier: ${error.message}`,
      );
    }
  }

  getFileUrl(objectName: string): string {
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
