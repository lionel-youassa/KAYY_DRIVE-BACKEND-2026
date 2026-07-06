import { Test, type TestingModule } from '@nestjs/testing';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';

describe('Storage (Controller & Service)', () => {
    let controller: StorageController;
    let service: StorageService;

    // Mock du client MinIO interne et de ses méthodes de rechange
    const mockMinioClient = {
        bucketExists: jest.fn(),
        makeBucket: jest.fn(),
        putObject: jest.fn(),
        removeObject: jest.fn(),
    };

    // Mock du ConfigService de NestJS
    const mockConfigService = {
        get: jest.fn((key: string) => {
            const config: Record<string, string> = {
                MINIO_ENDPOINT: 'localhost',
                MINIO_PORT: '9000',
                MINIO_USE_SSL: 'false',
                MINIO_ACCESS_KEY: 'test-access-key',
                MINIO_SECRET_KEY: 'test-secret-key',
                MINIO_BUCKET: 'kayydrive-test',
            };
            return config[key];
        }),
    };

    // Mock d'un fichier Express.Multer.File valide pour les tests
    const mockValidFile = {
        originalname: 'photo.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake-image-data'),
    } as Express.Multer.File;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [StorageController],
            providers: [
                StorageService,
                { provide: ConfigService, useValue: mockConfigService },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: () => true }) // Contourne le guard d'authentification
            .compile();

        controller = module.get<StorageController>(StorageController);
        service = module.get<StorageService>(StorageService);

        // Injection manuelle du client minio mocké créé dans le constructeur du service
        (service as any).minioClient = mockMinioClient;
        (service as any).bucketName = 'kayydrive-test';

        jest.clearAllMocks();
    });

    // =========================================================================
    // TESTS DU SERVICE (StorageService)
    // =========================================================================
    describe('StorageService', () => {
        describe('onModuleInit', () => {
            it('should create the bucket if it does not exist', async () => {
                mockMinioClient.bucketExists.mockResolvedValue(false);
                mockMinioClient.makeBucket.mockResolvedValue(undefined);

                await service.onModuleInit();

                expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('kayydrive-test');
                expect(mockMinioClient.makeBucket).toHaveBeenCalledWith('kayydrive-test');
            });

            it('should not create the bucket if it already exists', async () => {
                mockMinioClient.bucketExists.mockResolvedValue(true);

                await service.onModuleInit();

                expect(mockMinioClient.bucketExists).toHaveBeenCalledWith('kayydrive-test');
                expect(mockMinioClient.makeBucket).not.toHaveBeenCalled();
            });
        });

        describe('uploadFile', () => {
            it('should upload file successfully to MinIO and return its URL', async () => {
                mockMinioClient.putObject.mockResolvedValue(undefined);

                const url = await service.uploadFile(mockValidFile, 'incidents');

                expect(mockMinioClient.putObject).toHaveBeenCalledWith(
                    'kayydrive-test',
                    expect.stringContaining('incidents/'),
                    mockValidFile.buffer,
                    mockValidFile.size,
                    { 'Content-Type': mockValidFile.mimetype },
                );
                expect(url).toContain('http://localhost:9000/kayydrive-test/incidents/');
            });
        });

        describe('deleteFile', () => {
            it('should remove object from MinIO bucket', async () => {
                mockMinioClient.removeObject.mockResolvedValue(undefined);

                await service.deleteFile('incidents/test-file.png');

                expect(mockMinioClient.removeObject).toHaveBeenCalledWith(
                    'kayydrive-test',
                    'incidents/test-file.png',
                );
            });
        });
    });

    // =========================================================================
    // TESTS DU CONTRÔLEUR (StorageController)
    // =========================================================================
    describe('StorageController', () => {
        describe('POST /storage/upload', () => {
            it('should throw BadRequestException if no file is provided', async () => {
                await expect(
                    controller.uploadImage(undefined as any, 'users'),
                ).rejects.toThrow(new BadRequestException('Aucun fichier fourni'));
            });

            it('should throw BadRequestException if file mime type is not allowed', async () => {
                const invalidFile = {
                    originalname: 'document.pdf',
                    mimetype: 'application/pdf',
                    size: 2048,
                    buffer: Buffer.from('%PDF-1.4...'),
                } as Express.Multer.File;

                await expect(
                    controller.uploadImage(invalidFile, 'users'),
                ).rejects.toThrow(
                    new BadRequestException(
                        'Type de fichier non autorisé. Seuls les images sont acceptées.',
                    ),
                );
            });

            it('should call service.uploadFile and return url on valid file upload', async () => {
                const mockUrl = 'http://localhost:9000/kayydrive-test/users/123-photo.png';
                jest.spyOn(service, 'uploadFile').mockResolvedValue(mockUrl);

                const response = await controller.uploadImage(mockValidFile, 'users');

                expect(service.uploadFile).toHaveBeenCalledWith(mockValidFile, 'users');
                expect(response).toEqual({
                    success: true,
                    url: mockUrl,
                });
            });

            it('should fallback to default folder "uploads" if folder parameter is missing', async () => {
                const mockUrl = 'http://localhost:9000/kayydrive-test/uploads/123-photo.png';
                jest.spyOn(service, 'uploadFile').mockResolvedValue(mockUrl);

                await controller.uploadImage(mockValidFile, undefined);

                expect(service.uploadFile).toHaveBeenCalledWith(mockValidFile, 'uploads');
            });
        });
    });
});