import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

function createService(config: Record<string, string | undefined>) {
  const configService = {
    get: (key: string) => config[key],
  } as unknown as ConfigService;

  return new StorageService(configService);
}

describe('StorageService', () => {
  it('génère et extrait les URLs publiques R2 sans bucket', () => {
    const service = createService({
      S3_ENDPOINT: 'account.r2.cloudflarestorage.com',
      S3_PORT: '443',
      S3_USE_SSL: 'true',
      S3_REGION: 'auto',
      S3_BUCKET: 'kayydrive',
      S3_PUBLIC_BASE_URL: 'https://pub-123.r2.dev',
    });

    expect(service.getFileUrl('profiles/photo.jpg')).toBe(
      'https://pub-123.r2.dev/profiles/photo.jpg',
    );
    expect(
      service.extractObjectName('https://pub-123.r2.dev/profiles/photo.jpg'),
    ).toBe('profiles/photo.jpg');
  });

  it('conserve la sémantique bucket de MINIO_PUBLIC_URL', () => {
    const service = createService({
      MINIO_ENDPOINT: 'minio',
      MINIO_PORT: '9000',
      MINIO_USE_SSL: 'false',
      MINIO_BUCKET: 'kayydrive',
      MINIO_PUBLIC_URL: 'http://localhost:9000',
    });

    expect(service.getFileUrl('profiles/photo.jpg')).toBe(
      'http://localhost:9000/kayydrive/profiles/photo.jpg',
    );
  });

  it("utilise localhost comme fallback public pour l'hôte minio", () => {
    const service = createService({
      S3_ENDPOINT: 'minio',
      S3_PORT: '9000',
      S3_USE_SSL: 'false',
      S3_BUCKET: 'kayydrive',
    });

    expect(service.getFileUrl('photo.jpg')).toBe(
      'http://localhost:9000/kayydrive/photo.jpg',
    );
  });

  it('normalise un endpoint fourni avec son schéma', () => {
    const service = createService({
      S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      S3_BUCKET: 'kayydrive',
      S3_PUBLIC_BASE_URL: '',
    });

    expect(service.getFileUrl('photo.jpg')).toBe(
      'https://account.r2.cloudflarestorage.com/kayydrive/photo.jpg',
    );
  });

  it('envoie le fichier via PutObject et renvoie son URL publique', async () => {
    const service = createService({
      S3_ENDPOINT: 'account.r2.cloudflarestorage.com',
      S3_PORT: '443',
      S3_USE_SSL: 'true',
      S3_REGION: 'auto',
      S3_BUCKET: 'kayydrive',
      S3_PUBLIC_BASE_URL: 'https://pub-123.r2.dev',
    });
    const send = jest.fn().mockResolvedValue({});
    (service as unknown as { client: { send: typeof send } }).client = {
      send,
    };

    const file = {
      originalname: 'photo.jpg',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('image'),
    } as Express.Multer.File;

    const url = await service.uploadFile(file, 'profiles');

    expect(url).toMatch(
      /^https:\/\/pub-123\.r2\.dev\/profiles\/\d+-photo\.jpg$/,
    );
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('refuse les uploads quand le stockage est désactivé', async () => {
    const service = createService({});

    await expect(
      service.uploadFile({} as Express.Multer.File),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('refuse localhost sur Render', async () => {
    const previousRender = process.env.RENDER;
    process.env.RENDER = 'true';

    try {
      const service = createService({
        S3_ENDPOINT: 'localhost',
        S3_PORT: '9000',
        S3_BUCKET: 'kayydrive',
      });

      await expect(
        service.uploadFile({} as Express.Multer.File),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    } finally {
      if (previousRender === undefined) {
        delete process.env.RENDER;
      } else {
        process.env.RENDER = previousRender;
      }
    }
  });
});
