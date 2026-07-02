import { Test, TestingModule } from '@nestjs/testing';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateRouteDto } from './dto/create-route.dto';
import { VoteRouteDto } from './dto/vote-route.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('RoutesController', () => {
    let controller: RoutesController;
    let service: RoutesService;

    // Mock de l'utilisateur connecté via Firebase Auth
    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'user-driver-789',
        email: 'driver@kayydrive.cm',
    };

    // Simulation d'une trace sous forme de tableau de points GPS (PointGpsDto[])
    const mockTracePoints = [
        { latitude: 4.045, longitude: 9.750 },
        { latitude: 4.050, longitude: 9.755 },
        { latitude: 4.055, longitude: 9.760 },
    ];

    // Données fictives pour simuler un raccourci communautaire
    const mockRaccourci = {
        id: 'route-uuid-111',
        nom: 'Raccourci Ndokoti',
        description: 'Évite les bouchons du carrefour',
        pointDepart: { latitude: 4.045, longitude: 9.750 },
        pointArrivee: { latitude: 4.055, longitude: 9.760 },
        trace: mockTracePoints, // Remplacement du polyline string par le tableau attendu
        id_utilisateur_createur: 'user-driver-789',
        votesPour: 5,
        votesContre: 0,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RoutesController],
            providers: [
                {
                    provide: RoutesService,
                    useValue: {
                        createRaccourci: jest.fn(),
                        voterRaccourci: jest.fn(),
                        getSuggestionsRaccourcis: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<RoutesController>(RoutesController);
        service = module.get<RoutesService>(RoutesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('POST /routes (create)', () => {
        it('devrait créer un raccourci et injecter l\'UID de l\'utilisateur connecté', async () => {
            const dto: CreateRouteDto = {
                nom: 'Raccourci Ndokoti',
                description: 'Évite les bouchons du carrefour',
                pointDepart: { latitude: 4.045, longitude: 9.750 },
                pointArrivee: { latitude: 4.055, longitude: 9.760 },
                trace: mockTracePoints, // Plus besoin de @ts-ignore ici
            };

            jest.spyOn(service, 'createRaccourci').mockResolvedValue(mockRaccourci as any);

            const result = await controller.create(dto, mockFirebaseUser as DecodedIdToken);

            expect(service.createRaccourci).toHaveBeenCalledWith({
                nom: dto.nom,
                description: dto.description,
                pointDepart: dto.pointDepart,
                pointArrivee: dto.pointArrivee,
                trace: dto.trace,
                id_utilisateur_createur: mockFirebaseUser.uid,
            });
            expect(result).toEqual({ success: true, raccourci: mockRaccourci });
        });
    });

    describe('POST /routes/:id/voter (voter)', () => {
        it('devrait enregistrer un vote (pour ou contre) de l\'utilisateur sur un raccourci', async () => {
            // @ts-ignore
            const dto: VoteRouteDto = { vote: 'pour' };
            const mockVoteResult = { votesPour: 6, votesContre: 0 };

            // @ts-ignore
            jest.spyOn(service, 'voterRaccourci').mockResolvedValue(mockVoteResult);

            const result = await controller.voter('route-uuid-111', dto, mockFirebaseUser as DecodedIdToken);

            expect(service.voterRaccourci).toHaveBeenCalledWith('route-uuid-111', mockFirebaseUser.uid, 'pour');
            expect(result).toEqual({ success: true, ...mockVoteResult });
        });
    });

    describe('GET /routes/suggestions (suggestions)', () => {
        it('devrait convertir les query params string en nombres flottants et retourner les suggestions', async () => {
            const mockSuggestions = [mockRaccourci];
            // @ts-ignore
            jest.spyOn(service, 'getSuggestionsRaccourcis').mockResolvedValue(mockSuggestions as any);

            const result = await controller.suggestions('4.045', '9.750', '4.055', '9.760');

            expect(service.getSuggestionsRaccourcis).toHaveBeenCalledWith(4.045, 9.750, 4.055, 9.760);
            expect(result).toEqual({ suggestions: mockSuggestions });
        });
    });
});