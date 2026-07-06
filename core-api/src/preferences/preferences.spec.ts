import { Test, type TestingModule } from '@nestjs/testing';
import { PreferencesController } from './preferences.controller';
import { PreferencesService, type PreferencesUtilisateur } from './preferences.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { UpdatePreferencesDto } from './dto/update-preferences.dto';

describe('Preferences (Controller & Service)', () => {
    let controller: PreferencesController;
    let service: PreferencesService;
    let prismaService: PrismaService;

    // Mock du jeton Firebase décodé représentant l'utilisateur connecté
    const mockUser = { uid: 'user-789' } as DecodedIdToken;

    // Valeurs par défaut attendues d'après le service
    const defaultPreferences: PreferencesUtilisateur = {
        eviterPeages: false,
        prioriserRoutesSecu: true,
        eviterZonesInondables: true,
        modeHorsLigneActif: false,
    };

    // Mock de l'entité retournée par la base de données PostgreSQL / Prisma
    const mockDbPreferences = {
        id: 'pref-123',
        utilisateurId: 'user-789',
        eviterPeages: true,
        prioriserRoutesSecu: false,
        eviterZonesInondables: true,
        modeHorsLigneActif: true,
    };

    // Objet mock pour PrismaService
    const mockPrismaService = {
        preferencesUtilisateur: {
            findUnique: jest.fn(),
            upsert: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PreferencesController],
            providers: [
                PreferencesService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: () => true }) // Contourne la sécurité du Guard pour les tests unitaires
            .compile();

        controller = module.get<PreferencesController>(PreferencesController);
        service = module.get<PreferencesService>(PreferencesService);
        prismaService = module.get<PrismaService>(PrismaService);

        jest.clearAllMocks();
    });

    // =========================================================================
    // TESTS DU SERVICE (PreferencesService)
    // =========================================================================
    describe('PreferencesService', () => {
        describe('getPreferences', () => {
            it('should return default preferences if user has no record in database', async () => {
                mockPrismaService.preferencesUtilisateur.findUnique.mockResolvedValue(null);

                const result = await service.getPreferences('unknown-user');

                expect(prismaService.preferencesUtilisateur.findUnique).toHaveBeenCalledWith({
                    where: { utilisateurId: 'unknown-user' },
                });
                expect(result).toEqual(defaultPreferences);
            });

            it('should return mapped preferences from database if record exists', async () => {
                mockPrismaService.preferencesUtilisateur.findUnique.mockResolvedValue(mockDbPreferences);

                const result = await service.getPreferences('user-789');

                expect(prismaService.preferencesUtilisateur.findUnique).toHaveBeenCalledWith({
                    where: { utilisateurId: 'user-789' },
                });
                expect(result).toEqual({
                    eviterPeages: mockDbPreferences.eviterPeages,
                    prioriserRoutesSecu: mockDbPreferences.prioriserRoutesSecu,
                    eviterZonesInondables: mockDbPreferences.eviterZonesInondables,
                    modeHorsLigneActif: mockDbPreferences.modeHorsLigneActif,
                });
            });
        });

        describe('updatePreferences', () => {
            it('should call prisma upsert with updates and default fallbacks', async () => {
                mockPrismaService.preferencesUtilisateur.upsert.mockResolvedValue(mockDbPreferences);

                const partialUpdate: Partial<PreferencesUtilisateur> = {
                    eviterPeages: true,
                };

                const result = await service.updatePreferences('user-789', partialUpdate);

                expect(prismaService.preferencesUtilisateur.upsert).toHaveBeenCalledWith({
                    where: { utilisateurId: 'user-789' },
                    update: partialUpdate,
                    create: {
                        utilisateurId: 'user-789',
                        eviterPeages: true, // Valeur fournie
                        prioriserRoutesSecu: defaultPreferences.prioriserRoutesSecu, // Fallback par défaut
                        eviterZonesInondables: defaultPreferences.eviterZonesInondables, // Fallback par défaut
                        modeHorsLigneActif: defaultPreferences.modeHorsLigneActif, // Fallback par défaut
                    },
                });

                // Vérifie le mapping de l'objet de retour
                expect(result).toEqual({
                    eviterPeages: mockDbPreferences.eviterPeages,
                    prioriserRoutesSecu: mockDbPreferences.prioriserRoutesSecu,
                    eviterZonesInondables: mockDbPreferences.eviterZonesInondables,
                    modeHorsLigneActif: mockDbPreferences.modeHorsLigneActif,
                });
            });
        });
    });

    // =========================================================================
    // TESTS DU CONTRÔLEUR (PreferencesController)
    // =========================================================================
    describe('PreferencesController', () => {
        describe('GET /preferences', () => {
            it('should return preferences wrapped in an object for the current user', async () => {
                const expectedServiceResult: PreferencesUtilisateur = {
                    eviterPeages: false,
                    prioriserRoutesSecu: true,
                    eviterZonesInondables: false,
                    modeHorsLigneActif: true,
                };

                jest.spyOn(service, 'getPreferences').mockResolvedValue(expectedServiceResult);

                const response = await controller.getPreferences(mockUser);

                expect(service.getPreferences).toHaveBeenCalledWith('user-789');
                expect(response).toEqual({ preferences: expectedServiceResult });
            });
        });

        describe('PATCH /preferences', () => {
            it('should update preferences via dto and return success true with payload', async () => {
                const dto: UpdatePreferencesDto = {
                    eviterPeages: true,
                    modeHorsLigneActif: true,
                };

                const expectedUpdatedPayload: PreferencesUtilisateur = {
                    eviterPeages: true,
                    prioriserRoutesSecu: true,
                    eviterZonesInondables: true,
                    modeHorsLigneActif: true,
                };

                jest.spyOn(service, 'updatePreferences').mockResolvedValue(expectedUpdatedPayload);

                const response = await controller.update(dto, mockUser);

                expect(service.updatePreferences).toHaveBeenCalledWith('user-789', dto);
                expect(response).toEqual({
                    success: true,
                    preferences: expectedUpdatedPayload,
                });
            });
        });
    });
});