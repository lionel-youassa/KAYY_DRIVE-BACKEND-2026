import { Test, TestingModule } from '@nestjs/testing';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { StorageService } from '../../storage/storage.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

describe('AdsController', () => {
    let controller: AdsController;
    let adsService: AdsService;
    let storageService: StorageService;

    const mockAdsService = {
        createAdvertising: jest.fn(),
        getAllAdvertising: jest.fn(),
        deleteAdvertising: jest.fn(),
    };

    const mockStorageService = {
        uploadFile: jest.fn(),
    };

    // Mock des Guards pour éviter les problèmes d'injection liés à JWT/Auth lors des tests unitaires
    const mockGuard = { canActivate: () => true };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdsController],
            providers: [
                { provide: AdsService, useValue: mockAdsService },
                { provide: StorageService, useValue: mockStorageService },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue(mockGuard)
            .overrideGuard(AdminGuard)
            .useValue(mockGuard)
            .compile();

        controller = module.get<AdsController>(AdsController);
        adsService = module.get<AdsService>(AdsService);
        storageService = module.get<StorageService>(StorageService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createAdvertising', () => {
        it('should create an ad with an uploaded file URL', async () => {
            const mockBody = { titre: 'Soldes d\'hiver' };
            const mockFile = { originalname: 'test.jpg' } as Express.Multer.File;
            const mockImageUrl = 'http://storage/ads/test.jpg';
            const mockCreatedAd = { id: '123', titre: "Soldes d'hiver", imageUrl: mockImageUrl };

            mockStorageService.uploadFile.mockResolvedValue(mockImageUrl);
            mockAdsService.createAdvertising.mockResolvedValue(mockCreatedAd);

            const result = await controller.createAdvertising(mockBody, mockFile);

            expect(storageService.uploadFile).toHaveBeenCalledWith(mockFile, 'ads');
            expect(adsService.createAdvertising).toHaveBeenCalledWith({
                ...mockBody,
                imageUrl: mockImageUrl,
            });
            expect(result).toEqual({
                success: true,
                message: 'Publicité créée avec succès',
                ad: mockCreatedAd,
            });
        });

        it('should create an ad without file if none is provided', async () => {
            const mockBody = { titre: 'Texte uniquement' };
            const mockCreatedAd = { id: '124', titre: 'Texte uniquement', imageUrl: undefined };

            mockAdsService.createAdvertising.mockResolvedValue(mockCreatedAd);

            const result = await controller.createAdvertising(mockBody, undefined);

            expect(storageService.uploadFile).not.toHaveBeenCalled();
            expect(adsService.createAdvertising).toHaveBeenCalledWith({
                ...mockBody,
                imageUrl: undefined,
            });
            expect(result.ad).toEqual(mockCreatedAd);
        });
    });

    describe('getAllAdvertising', () => {
        it('should return all advertising', async () => {
            const mockAds = [{ id: '1' }, { id: '2' }];
            mockAdsService.getAllAdvertising.mockResolvedValue(mockAds);

            const result = await controller.getAllAdvertising();

            expect(adsService.getAllAdvertising).toHaveBeenCalled();
            expect(result).toEqual({ ads: mockAds });
        });
    });

    describe('deleteAdvertising', () => {
        it('should delete an advertisement and return success', async () => {
            mockAdsService.deleteAdvertising.mockResolvedValue({ id: '1' });

            const result = await controller.deleteAdvertising('1');

            expect(adsService.deleteAdvertising).toHaveBeenCalledWith('1');
            expect(result).toEqual({ success: true, message: 'Publicité supprimée' });
        });
    });
});