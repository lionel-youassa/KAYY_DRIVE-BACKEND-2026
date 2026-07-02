import { Test, TestingModule } from '@nestjs/testing';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

describe('AdsController', () => {
    let controller: AdsController;
    let service: AdsService;

    const mockAdResult = {
        id: 'ad-uuid-123',
        titre: 'Promo Fin d\'année',
        type: 'banniere',
        dateDebut: '2026-12-01T00:00:00.000Z',
        dateFin: '2026-12-31T23:59:59.000Z',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdsController],
            providers: [
                {
                    provide: AdsService,
                    useValue: {
                        createAdvertising: jest.fn(),
                        getAllAdvertising: jest.fn(),
                        deleteAdvertising: jest.fn(),
                    },
                },
            ],
        })
            // Court-circuit des guards d'authentification et d'administration pour isoler le contrôleur
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .overrideGuard(AdminGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<AdsController>(AdsController);
        service = module.get<AdsService>(AdsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('POST /ads (createAdvertising)', () => {
        it('devrait appeler adsService.createAdvertising avec les données transmises', async () => {
            const payload = {
                titre: 'Promo Fin d\'année',
                type: 'banniere',
                mediaPath: '/uploads/ad1.png',
            };

            // @ts-ignore
            jest.spyOn(service, 'createAdvertising').mockResolvedValue(mockAdResult);

            const result = await controller.createAdvertising(payload);

            expect(service.createAdvertising).toHaveBeenCalledWith(payload);
            expect(result).toEqual(mockAdResult);
        });
    });

    describe('GET /ads (getAllAdvertising)', () => {
        it('devrait retourner la liste de toutes les publicités', async () => {
            const mockAdsList = [mockAdResult];
            // @ts-ignore
            jest.spyOn(service, 'getAllAdvertising').mockResolvedValue(mockAdsList);

            const result = await controller.getAllAdvertising();

            expect(service.getAllAdvertising).toHaveBeenCalled();
            expect(result).toEqual(mockAdsList);
        });
    });

    describe('DELETE /ads/:id (deleteAdvertising)', () => {
        it('devrait supprimer une publicité grâce à son identifiant', async () => {
            // @ts-ignore
            jest.spyOn(service, 'deleteAdvertising').mockResolvedValue(mockAdResult);

            const result = await controller.deleteAdvertising('ad-uuid-123');

            expect(service.deleteAdvertising).toHaveBeenCalledWith('ad-uuid-123');
            expect(result).toEqual(mockAdResult);
        });
    });
});