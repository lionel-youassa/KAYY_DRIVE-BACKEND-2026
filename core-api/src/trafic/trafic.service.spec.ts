import { Test, TestingModule } from '@nestjs/testing';
import { TraficService } from './trafic.service';
import { FirebaseService } from '../firebase/firebase.service';

describe('TraficService', () => {
    let service: TraficService;

    // Mock pour Firestore avec support du chaînage .where().get()
    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn(),
        add: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TraficService,
                {
                    provide: FirebaseService,
                    useValue: {
                        db: mockFirestore,
                    },
                },
            ],
        }).compile();

        service = module.get<TraficService>(TraficService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('enregistrerRelevé', () => {
        it('devrait ajouter un relevé avec le niveau calculé et renvoyer l\'objet complet', async () => {
            const inputData = {
                latitude: 4.0511,
                longitude: 9.7679,
                vitesseMoyenne: 45, // >= 30 donc 'fluide'
                id_utilisateur: 'user-123',
            };

            mockFirestore.add.mockResolvedValue({ id: 'new-doc-id' });

            const result = await service.enregistrerRelevé(inputData);

            expect(mockFirestore.collection).toHaveBeenCalledWith('trafic');
            expect(mockFirestore.add).toHaveBeenCalledWith(
                expect.objectContaining({
                    latitude: 4.0511,
                    vitesseMoyenne: 45,
                    niveau: 'fluide',
                    timestamp: expect.any(String),
                }),
            );
            expect(result.id).toBe('new-doc-id');
            expect(result.niveau).toBe('fluide');
        });
    });

    describe('getTraficActuel', () => {
        const baseLat = 4.0511;
        const baseLng = 9.7679;

        it('devrait retourner un niveau "fluide" par défaut (0 relevé) s\'il n\'y a aucun échantillon récent', async () => {
            mockFirestore.get.mockResolvedValue({ docs: [] });

            const result = await service.getTraficActuel(baseLat, baseLng);

            expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '>', expect.any(String));
            expect(result).toEqual({
                niveau: 'fluide',
                vitesseMoyenne: 0,
                nombreReleves: 0,
            });
        });

        it('devrait filtrer les relevés par rayon et calculer la moyenne pondérée des vitesses récentes', async () => {
            const mockDocs = [
                {
                    data: () => ({
                        latitude: 4.0512, // Très proche (~15m)
                        longitude: 9.7680,
                        vitesseMoyenne: 15, // Zone dense
                        timestamp: new Date().toISOString(),
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.0510, // Très proche
                        longitude: 9.7678,
                        vitesseMoyenne: 5, // Zone bouchon
                        timestamp: new Date().toISOString(),
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.2500, // Trop éloigné (~22km) -> Doit être exclu par le filtre de rayon
                        longitude: 9.9500,
                        vitesseMoyenne: 50,
                        timestamp: new Date().toISOString(),
                    }),
                },
            ];

            mockFirestore.get.mockResolvedValue({ docs: mockDocs });

            // Recherche dans un rayon par défaut de 1000m
            const result = await service.getTraficActuel(baseLat, baseLng, 1000);

            // Seuls les 2 premiers relevés sont valides. Moyenne = (15 + 5) / 2 = 10 km/h (niveau: 'dense')
            expect(result.nombreReleves).toBe(2);
            expect(result.vitesseMoyenne).toBe(10);
            expect(result.niveau).toBe('dense');
        });
    });
});