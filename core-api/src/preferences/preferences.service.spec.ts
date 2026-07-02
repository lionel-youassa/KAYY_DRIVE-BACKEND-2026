import { Test, TestingModule } from '@nestjs/testing';
import { PreferencesService } from './preferences.service';
import { FirebaseService } from '../firebase/firebase.service';

describe('PreferencesService', () => {
    let service: PreferencesService;

    // Mock pour l'API Firestore DocumentReference
    const mockDocSnapshot = {
        exists: false,
        data: jest.fn(),
    };

    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        doc: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue(mockDocSnapshot),
        set: jest.fn().mockResolvedValue(undefined),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PreferencesService,
                {
                    provide: FirebaseService,
                    useValue: {
                        db: mockFirestore,
                    },
                },
            ],
        }).compile();

        service = module.get<PreferencesService>(PreferencesService);
    });

    afterEach(() => {
        mockDocSnapshot.exists = false;
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getPreferences', () => {
        it('devrait retourner le profil de préférences par défaut si le document n\'existe pas', async () => {
            mockDocSnapshot.exists = false;

            const uid = 'new-user-456';
            const result = await service.getPreferences(uid);

            expect(mockFirestore.collection).toHaveBeenCalledWith('preferences');
            expect(mockFirestore.doc).toHaveBeenCalledWith(uid);
            expect(result.id_utilisateur).toBe(uid);
            expect(result.modeDeplacement).toBe('voiture');
            expect(result.langue).toBe('fr');
            expect(result.dateMiseAJour).toBeDefined();
        });

        it('devrait retourner les données réelles de Firestore si le document existe', async () => {
            mockDocSnapshot.exists = true;
            const fakePreferences = {
                id_utilisateur: 'user-789',
                modeDeplacement: 'moto',
                eviterZonesRisque: false,
                langue: 'en',
            };
            mockDocSnapshot.data.mockReturnValue(fakePreferences);

            const result = await service.getPreferences('user-789');

            expect(result).toEqual(fakePreferences);
        });
    });

    describe('updatePreferences', () => {
        it('devrait fusionner les mises à jour et les enregistrer dans Firestore via set', async () => {
            mockDocSnapshot.exists = true;
            const currentPreferences = {
                id_utilisateur: 'user-789',
                modeDeplacement: 'voiture',
                langue: 'fr',
                eviterZonesRisque: true,
            };
            mockDocSnapshot.data.mockReturnValue(currentPreferences);

            const updates = { modeDeplacement: 'pied' as const };
            const result = await service.updatePreferences('user-789', updates);

            expect(mockFirestore.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    id_utilisateur: 'user-789',
                    modeDeplacement: 'pied',
                    langue: 'fr',
                })
            );
            expect(result.modeDeplacement).toBe('pied');
        });
    });
});