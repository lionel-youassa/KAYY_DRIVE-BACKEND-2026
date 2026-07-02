import { Test, TestingModule } from '@nestjs/testing';
import { PreferencesController } from './preferences.controller';
import { PreferencesService, PreferencesUtilisateur } from './preferences.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('PreferencesController', () => {
    let controller: PreferencesController;
    let service: PreferencesService;

    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'user-pref-uuid-123',
        email: 'driver@kayydrive.cm',
    };

    const mockPreferences: PreferencesUtilisateur = {
        id_utilisateur: 'user-pref-uuid-123',
        modeDeplacement: 'voiture',
        notificationsIncidents: true,
        notificationsRaccourcis: true,
        eviterZonesRisque: true,
        unite: 'km',
        langue: 'fr',
        dateMiseAJour: new Date().toISOString(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PreferencesController],
            providers: [
                {
                    provide: PreferencesService,
                    useValue: {
                        getPreferences: jest.fn(),
                        updatePreferences: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<PreferencesController>(PreferencesController);
        service = module.get<PreferencesService>(PreferencesService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /preferences', () => {
        it('devrait récupérer les préférences associées à l\'utilisateur connecté', async () => {
            jest.spyOn(service, 'getPreferences').mockResolvedValue(mockPreferences);

            const result = await controller.getPreferences(mockFirebaseUser as DecodedIdToken);

            expect(service.getPreferences).toHaveBeenCalledWith(mockFirebaseUser.uid);
            expect(result).toEqual({ preferences: mockPreferences });
        });
    });

    describe('PATCH /preferences', () => {
        it('devrait mettre à jour et retourner les nouvelles préférences de l\'utilisateur', async () => {
            const dto: UpdatePreferencesDto = {
                modeDeplacement: 'moto',
                langue: 'en',
            };

            const mockUpdatedPreferences = { ...mockPreferences, ...dto };
            jest.spyOn(service, 'updatePreferences').mockResolvedValue(mockUpdatedPreferences);

            const result = await controller.update(dto, mockFirebaseUser as DecodedIdToken);

            expect(service.updatePreferences).toHaveBeenCalledWith(mockFirebaseUser.uid, dto);
            expect(result).toEqual({ success: true, preferences: mockUpdatedPreferences });
        });
    });
});