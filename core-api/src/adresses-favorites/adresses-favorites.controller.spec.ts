import { Test, TestingModule } from '@nestjs/testing';
import { AdressesFavoritesController } from './adresses-favorites.controller';
import { AdressesFavoritesService } from './adresses-favorites.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateAdresseFavoriteDto } from './dto/create-adresse-favorite.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('AdressesFavoritesController', () => {
    let controller: AdressesFavoritesController;
    let service: AdressesFavoritesService;

    // Simulation d'un utilisateur Firebase connecté retourné par @CurrentUser()
    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'firebase-user-uuid-123',
        email: 'test@kayydrive.cm',
    };

    // Données de test
    const mockAdresses = [
        { id: 'addr-1', nom: 'Maison', latitude: 4.0511, longitude: 9.7679, id_utilisateur: 'firebase-user-uuid-123' },
        { id: 'addr-2', nom: 'Bureau', latitude: 3.8488, longitude: 11.5021, id_utilisateur: 'firebase-user-uuid-123' },
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdressesFavoritesController],
            providers: [
                {
                    provide: AdressesFavoritesService,
                    useValue: {
                        getAdressesFavorites: jest.fn(),
                        createAdresseFavorite: jest.fn(),
                        deleteAdresseFavorite: jest.fn(),
                    },
                },
            ],
        })
            // On mock le AuthGuard pour qu'il autorise toujours l'accès pendant les tests unitaires
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<AdressesFavoritesController>(AdressesFavoritesController);
        service = module.get<AdressesFavoritesService>(AdressesFavoritesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /adresses-favorites', () => {
        it('devrait retourner la liste des adresses favorites de l\'utilisateur connecté', async () => {
            jest.spyOn(service, 'getAdressesFavorites').mockResolvedValue(mockAdresses);

            const result = await controller.getAll(mockFirebaseUser as DecodedIdToken);

            expect(service.getAdressesFavorites).toHaveBeenCalledWith(mockFirebaseUser.uid);
            expect(result).toEqual({ adresses: mockAdresses });
        });
    });

    describe('POST /adresses-favorites', () => {
        it('devrait créer une nouvelle adresse favorite avec l\'UID de l\'utilisateur connecté', async () => {
            const dto: CreateAdresseFavoriteDto = {
                nom: 'Salle de sport',
                latitude: 4.0600,
                longitude: 9.7800,
                categorieId: 'cat-sport',
            };

            const mockGeneratedId = 'new-addr-uuid-999';
            jest.spyOn(service, 'createAdresseFavorite').mockResolvedValue(mockGeneratedId);

            const result = await controller.create(dto, mockFirebaseUser as DecodedIdToken);

            expect(service.createAdresseFavorite).toHaveBeenCalledWith({
                ...dto,
                id_utilisateur: mockFirebaseUser.uid,
            });
            expect(result).toEqual({ success: true, id: mockGeneratedId });
        });
    });

    describe('DELETE /adresses-favorites/:id', () => {
        it('devrait appeler la méthode de suppression du service avec l\'id de l\'adresse', async () => {
            jest.spyOn(service, 'deleteAdresseFavorite').mockResolvedValue(undefined);

            const targetId = 'addr-1';
            const result = await controller.delete(targetId);

            expect(service.deleteAdresseFavorite).toHaveBeenCalledWith(targetId);
            expect(result).toEqual({ success: true });
        });
    });
});