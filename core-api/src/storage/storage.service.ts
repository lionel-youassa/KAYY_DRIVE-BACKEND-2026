import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly enabled: boolean;
  private readonly autoCreateBucket: boolean;
  private readonly setPublicPolicy: boolean;
  private readonly publicBaseUrl: string;
  private readonly legacyPublicUrl: boolean;
  private readonly endpointUrl: string;
  private readonly fallbackPublicBaseUrl: string;

  constructor(private configService: ConfigService) {
    const rawEndpoint =
      this.firstDefined('S3_ENDPOINT', 'MINIO_ENDPOINT') || '';
    const endpoint = this.parseEndpoint(rawEndpoint);
    const useSSLConfig =
      this.configService.get<string>('S3_USE_SSL') ??
      this.configService.get<string>('MINIO_USE_SSL');
    const useSSL =
      useSSLConfig === undefined
        ? /^https:\/\//i.test(rawEndpoint) || endpoint.port === '443'
        : useSSLConfig.trim().toLowerCase() === 'true';
    const port =
      this.firstDefined('S3_PORT', 'MINIO_PORT') ||
      endpoint.port ||
      (useSSL ? '443' : '80');
    const portNumber = parseInt(port, 10);
    const scheme = useSSL ? 'https' : 'http';
    const defaultPort = useSSL ? 443 : 80;

    this.endpointUrl = endpoint.host
      ? `${scheme}://${endpoint.host}${
          portNumber === defaultPort ? '' : `:${portNumber}`
        }`
      : '';

    const fallbackHost =
      endpoint.host === 'minio' ? 'localhost' : endpoint.host;
    this.fallbackPublicBaseUrl = fallbackHost
      ? `${scheme}://${fallbackHost}${
          portNumber === defaultPort ? '' : `:${portNumber}`
        }`
      : '';

    const accessKey = this.firstDefined('S3_ACCESS_KEY', 'MINIO_ACCESS_KEY');
    const secretKey = this.firstDefined('S3_SECRET_KEY', 'MINIO_SECRET_KEY');
    this.bucketName =
      this.firstDefined('S3_BUCKET', 'MINIO_BUCKET') || 'kayydrive';

    const publicBase = this.firstDefined('S3_PUBLIC_BASE_URL');
    const legacyPublic = this.firstDefined('MINIO_PUBLIC_URL');
    this.publicBaseUrl = (publicBase || legacyPublic || '').replace(/\/+$/, '');
    this.legacyPublicUrl = !publicBase && Boolean(legacyPublic);

    const invalidOnRender =
      process.env.RENDER === 'true' &&
      (endpoint.host === 'localhost' || endpoint.host === '127.0.0.1');
    this.enabled =
      Boolean(this.endpointUrl && this.bucketName) && !invalidOnRender;

    this.client = new S3Client({
      region: this.firstDefined('S3_REGION') || 'us-east-1',
      endpoint: this.endpointUrl || undefined,
      forcePathStyle: this.readBoolean('S3_FORCE_PATH_STYLE', undefined, true),
      credentials:
        accessKey && secretKey
          ? { accessKeyId: accessKey, secretAccessKey: secretKey }
          : undefined,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    this.autoCreateBucket = this.readBoolean(
      'S3_AUTO_CREATE_BUCKET',
      undefined,
      !isProduction,
    );
    this.setPublicPolicy = this.readBoolean(
      'S3_SET_PUBLIC_POLICY',
      undefined,
      !isProduction,
    );
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.warn(
        'Stockage S3 non configuré (S3_ENDPOINT/MINIO_ENDPOINT absent ou localhost sur Render) : les uploads renverront 503.',
      );
      return;
    }

    this.logger.log(
      `Stockage S3 configuré: endpoint=${this.endpointUrl}, bucket=${this.bucketName}, publicBase=${this.publicBaseUrl || '(non défini)'}`,
    );

    try {
      await this.client.send(
        new HeadBucketCommand({ Bucket: this.bucketName }),
      );
      this.logger.log(`Bucket ${this.bucketName} accessible`);
    } catch (error) {
      if (!this.autoCreateBucket) {
        this.logger.warn(
          `Bucket ${this.bucketName} inaccessible ou inexistant: ${this.errorDetails(error)}. Créez-le chez votre fournisseur S3 ou activez S3_AUTO_CREATE_BUCKET.`,
        );
        return;
      }

      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucketName }),
        );
        this.logger.log(`Bucket ${this.bucketName} créé avec succès`);
      } catch (createError) {
        this.logger.warn(
          `Impossible de créer le bucket ${this.bucketName}: ${this.errorDetails(createError)}. Vérifiez la configuration S3.`,
        );
        return;
      }
    }

    if (this.setPublicPolicy) {
      try {
        await this.client.send(
          new PutBucketPolicyCommand({
            Bucket: this.bucketName,
            Policy: JSON.stringify(this.publicReadPolicy()),
          }),
        );
        this.logger.log(
          `Politique de lecture publique appliquée au bucket ${this.bucketName}`,
        );
      } catch (error) {
        this.logger.warn(
          `Impossible d'appliquer la politique publique: ${this.errorDetails(error)}. Configurez l'accès public dans votre fournisseur S3/R2.`,
        );
      }
    }

    if (!this.publicBaseUrl) {
      this.logger.warn(
        "S3_PUBLIC_BASE_URL non défini : les URLs renvoyées utiliseront l'endpoint S3, qui peut ne pas être public.",
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
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (error) {
      const details = this.errorDetails(error);
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
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: this.normalizeObjectName(objectName),
        }),
      );
    } catch (error) {
      this.logger.error(
        `Erreur lors de la suppression du fichier: ${this.errorDetails(error)}`,
      );
    }
  }

  getFileUrl(objectName: string): string {
    const key = objectName.replace(/^\/+/, '');

    if (this.publicBaseUrl) {
      return this.legacyPublicUrl
        ? `${this.publicBaseUrl}/${this.bucketName}/${key}`
        : `${this.publicBaseUrl}/${key}`;
    }

    if (this.fallbackPublicBaseUrl) {
      return `${this.fallbackPublicBaseUrl}/${this.bucketName}/${key}`;
    }

    return '';
  }

  extractObjectName(url: string): string {
    if (!url) return '';

    const marker = `/${this.bucketName}/`;
    if (url.includes(marker)) {
      return url.split(marker)[1];
    }

    if (this.publicBaseUrl && url.startsWith(`${this.publicBaseUrl}/`)) {
      return url.slice(this.publicBaseUrl.length + 1);
    }

    try {
      return new URL(url).pathname.replace(/^\/+/, '');
    } catch {
      return '';
    }
  }

  private normalizeObjectName(objectName: string): string {
    return objectName.includes('://')
      ? this.extractObjectName(objectName)
      : objectName.replace(/^\/+/, '');
  }

  private publicReadPolicy() {
    return {
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
  }

  private parseEndpoint(raw: string): { host: string; port?: string } {
    const value = raw.trim();
    if (!value) return { host: '' };

    try {
      const url = new URL(
        /^https?:\/\//i.test(value) ? value : `http://${value}`,
      );
      return {
        host: url.hostname,
        port: url.port || undefined,
      };
    } catch {
      return {
        host: value.replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
      };
    }
  }

  private firstDefined(...keys: string[]): string | undefined {
    for (const key of keys) {
      const value = this.configService.get<string>(key)?.trim();
      if (value) return value;
    }
    return undefined;
  }

  private readBoolean(
    key: string,
    legacyKey: string | undefined,
    defaultValue: boolean,
  ): boolean {
    const raw =
      this.configService.get<string>(key) ??
      (legacyKey ? this.configService.get<string>(legacyKey) : undefined);

    if (raw === undefined || raw === null || raw.trim() === '') {
      return defaultValue;
    }

    return raw.trim().toLowerCase() === 'true';
  }

  private errorDetails(error: unknown): string {
    if (error instanceof Error) return error.message;

    if (typeof error === 'object' && error !== null) {
      const details = error as {
        message?: string;
        code?: string;
        name?: string;
      };
      return (
        details.message ||
        details.code ||
        details.name ||
        'Unknown storage error'
      );
    }

    return String(error);
  }
}
