import { Test, TestingModule } from '@nestjs/testing';
import { TraficController } from './trafic.controller';
import { TraficService, RelevéTrafic } from './trafic.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateTraficDto } from './dto/create-trafic.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('TraficController', () => {
    let controller: TraficController;
    let service: TraficService;

    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'user-trafic-123',
        email: 'driver@kayydrive.cm',
    };

    const mockReleve: RelevéTrafic = {
        id: 'releve-uuid-999',
        latitude: 4.0511,
        longitude: 9.7679,
        vitesseMoyenne: 35,
        niveau: 'fluide',
        id_utilisateur: 'user-trafic-123',
        timestamp: new Date().toISOString(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [TraficController],
            providers: [
                {
                    provide: TraficService,
                    useValue: {
                        getTraficActuel: jest.fn(),
                        enregistrerRelevé: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<TraficController>(TraficController);
        service = module.get<TraficService>(TraficService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /trafic', () => {
        it('devrait parser les query params string en float et renvoyer le trafic actuel', async () => {
            const mockResult = { niveau: 'fluide' as const, vitesseMoyenne: 35, nombreReleves: 5 };
            jest.spyOn(service, 'getTraficActuel').mockResolvedValue(mockResult);

            const result = await controller.getTrafic('4.0511', '9.7679', '1500');

            expect(service.getTraficActuel).toHaveBeenCalledWith(4.0511, 9.7679, 1500);
            expect(result).toEqual({ trafic: mockResult });
        });

        it('devrait appeler le service avec un rayon indéfini si non spécifié', async () => {
            jest.spyOn(service, 'getTraficActuel').mockResolvedValue({
                niveau: 'bouchon',
                vitesseMoyenne: 5,
                nombreReleves: 1,
            });

            await controller.getTrafic('4.0511', '9.7679', undefined);

            expect(service.getTraficActuel).toHaveBeenCalledWith(4.0511, 9.7679, undefined);
        });
    });

    describe('POST /trafic', () => {
        it('devrait enregistrer un relevé de trafic en y injectant l\'UID de l\'utilisateur connecté', async () => {
            const dto: CreateTraficDto = {
                latitude: 4.0511,
                longitude: 9.7679,
                vitesseMoyenne: 35,
            };

            jest.spyOn(service, 'enregistrerRelevé').mockResolvedValue(mockReleve);

            const result = await controller.create(dto, mockFirebaseUser as DecodedIdToken);

            expect(service.enregistrerRelevé).toHaveBeenCalledWith({
                latitude: dto.latitude,
                longitude: dto.longitude,
                vitesseMoyenne: dto.vitesseMoyenne,
                id_utilisateur: mockFirebaseUser.uid,
            });
            expect(result).toEqual({ success: true, relevé: mockReleve });
        });
    });
});