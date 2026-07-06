import { Test, type TestingModule } from '@nestjs/testing';
import { AdressesFavoritesController } from './adresses-favorites.controller';
import { AdressesFavoritesService } from './adresses-favorites.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { CreateAdresseFavoriteDto } from './dto/create-adresse-favorite.dto';

describe('AdressesFavorites (Controller & Service)', () => {
    let controller: AdressesFavoritesController;
    let service: AdressesFavoritesService;
    let prismaService: PrismaService;

    // Mock des données utilisateur Firebase
    const mockUser = { uid: 'user-123' } as DecodedIdToken;

    // Mock des données de retour de Prisma
    const mockDbAdresse = {
        id: 'fav-1',
        nom: 'Maison',
        adresse: '123 Rue Principale',
        latitude: 48.8566,
        longitude: 2.3522,
        categorieId: 'cat-1',
        utilisateurId: 'user-123',
        categorie: {
            id: 'cat-1',
            nom: 'Travail',
            icone: 'briefcase',
            couleur: '#FF0000',
        },
    };

    // Mock de PrismaService
    const mockPrismaService = {
        adresseFavorite: {
            create: jest.fn(),
            findMany: jest.fn(),
            delete: jest.fn(),
        },
    };

    // Mock du AuthGuard pour NestJS
    const mockAuthGuard = {
        canActivate: jest.fn(() => true),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [AdressesFavoritesController],
            providers: [
                AdressesFavoritesService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue(mockAuthGuard)
            .compile();

        controller = module.get<AdressesFavoritesController>(AdressesFavoritesController);
        service = module.get<AdressesFavoritesService>(AdressesFavoritesService);
        prismaService = module.get<PrismaService>(PrismaService);

        // Réinitialisation des mocks avant chaque test
        jest.clearAllMocks();
    });

    // --- TESTS DU SERVICE ---
    describe('AdressesFavoritesService', () => {
        it('should create a favorite address', async () => {
            mockPrismaService.adresseFavorite.create.mockResolvedValue(mockDbAdresse);

            const dto = {
                nom: 'Maison',
                adresse: '123 Rue Principale',
                latitude: 48.8566,
                longitude: 2.3522,
                categorieId: 'cat-1',
                id_utilisateur: 'user-123',
            };

            const result = await service.createAdresseFavorite(dto);

            expect(prismaService.adresseFavorite.create).toHaveBeenCalledWith({
                data: {
                    nom: dto.nom,
                    adresse: dto.adresse,
                    latitude: dto.latitude,
                    longitude: dto.longitude,
                    categorieId: dto.categorieId,
                    utilisateurId: dto.id_utilisateur,
                },
                include: { categorie: true },
            });
            expect(result).toEqual({
                id: 'fav-1',
                nom: 'Maison',
                adresse: '123 Rue Principale',
                latitude: 48.8566,
                longitude: 2.3522,
                categorieId: 'cat-1',
                categorie: {
                    id: 'cat-1',
                    nom: 'Travail',
                    icone: 'briefcase',
                    couleur: '#FF0000',
                },
                id_utilisateur: 'user-123',
            });
        });

        it('should return a list of favorite addresses', async () => {
            mockPrismaService.adresseFavorite.findMany.mockResolvedValue([mockDbAdresse]);

            const result = await service.getAdressesFavorites('user-123');

            expect(prismaService.adresseFavorite.findMany).toHaveBeenCalledWith({
                where: { utilisateurId: 'user-123' },
                include: { categorie: true },
            });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('fav-1');
        });

        it('should delete a favorite address', async () => {
            mockPrismaService.adresseFavorite.delete.mockResolvedValue(mockDbAdresse);

            await service.deleteAdresseFavorite('fav-1');

            expect(prismaService.adresseFavorite.delete).toHaveBeenCalledWith({
                where: { id: 'fav-1' },
            });
        });
    });

    // --- TESTS DU CONTROLEUR ---
    describe('AdressesFavoritesController', () => {
        it('should return all favorites addresses for current user', async () => {
            const serviceResult = [
                {
                    id: 'fav-1',
                    nom: 'Maison',
                    adresse: '123 Rue Principale',
                    latitude: 48.8566,
                    longitude: 2.3522,
                    categorieId: 'cat-1',
                    id_utilisateur: 'user-123',
                },
            ];
            jest.spyOn(service, 'getAdressesFavorites').mockResolvedValue(serviceResult);

            const result = await controller.getAll(mockUser);

            expect(service.getAdressesFavorites).toHaveBeenCalledWith('user-123');
            expect(result).toEqual({ adresses: serviceResult });
        });

        it('should create a favorite address via controller', async () => {
            const dto: CreateAdresseFavoriteDto = {
                nom: 'Maison',
                adresse: '123 Rue Principale',
                latitude: 48.8566,
                longitude: 2.3522,
                categorieId: 'cat-1',
            };

            const serviceResult = {
                id: 'fav-1',
                nom: 'Maison',
                adresse: '123 Rue Principale',
                latitude: 48.8566,
                longitude: 2.3522,
                categorieId: 'cat-1',
                categorie: {
                    id: 'cat-1',
                    nom: 'Travail',
                    icone: 'star',
                    couleur: 'blue',
                },
                id_utilisateur: 'user-123',
            };

            jest.spyOn(service, 'createAdresseFavorite').mockResolvedValue(serviceResult);

            const result = await controller.create(dto, mockUser);

            expect(service.createAdresseFavorite).toHaveBeenCalledWith({
                ...dto,
                id_utilisateur: 'user-123',
            });
            expect(result).toEqual({
                success: true,
                adresse: {
                    uid: 'fav-1',
                    nom: 'Maison',
                    adresse: '123 Rue Principale',
                    latitude: 48.8566,
                    longitude: 2.3522,
                    categorie: serviceResult.categorie,
                },
            });
        });

        it('should delete a favorite address via controller', async () => {
            jest.spyOn(service, 'deleteAdresseFavorite').mockResolvedValue(undefined);

            const result = await controller.delete('fav-1');

            expect(service.deleteAdresseFavorite).toHaveBeenCalledWith('fav-1');
            expect(result).toEqual({ success: true });
        });
    });
});