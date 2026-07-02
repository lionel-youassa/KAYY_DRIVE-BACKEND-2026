import { Test, TestingModule } from '@nestjs/testing';
// @ts-ignore
import { PredictionsService } from './predictions.service';
import { FirebaseService } from '../firebase/firebase.service';

describe('PredictionsService', () => {
    let service: PredictionsService;

    // Mock de l'API fluide de Firestore avec le support de .where()
    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PredictionsService,
                {
                    provide: FirebaseService,
                    useValue: {
                        db: mockFirestore,
                    },
                },
            ],
        }).compile();

        service = module.get<PredictionsService>(PredictionsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('predireTraficPoint', () => {
        const baseLat = 4.0511;
        const baseLng = 9.7679;
        // Lundi 2 mars 2026 à 08:30 (Jour de la semaine = 1, Heure = 8)
        const cibleDate = new Date('2026-03-02T08:30:00.000Z');

        it('devrait retourner un trafic "fluide" par défaut s\'il n\'y a aucun échantillon dans Firestore', async () => {
            mockFirestore.get.mockResolvedValue({ docs: [] });

            const result = await service.predireTraficPoint(baseLat, baseLng, cibleDate);

            expect(mockFirestore.collection).toHaveBeenCalledWith('trafic');
            expect(mockFirestore.where).toHaveBeenCalledWith('timestamp', '>', expect.any(String));
            expect(result).toEqual({
                latitude: baseLat,
                longitude: baseLng,
                jourSemaine: 1,
                heure: 8,
                niveauPredit: 'fluide',
                vitesseMoyennePredite: 0,
                confiance: 'faible',
                nombreEchantillons: 0,
            });
        });

        it('devrait filtrer correctement les échantillons par distance, jour et plage horaire (haversine)', async () => {
            const mockDocs = [
                {
                    data: () => ({
                        latitude: 4.0512, // Proche (~15m)
                        longitude: 9.7680,
                        timestamp: '2026-02-23T08:15:00.000Z', // Même jour (lundi) et heure proche (8h)
                        vitesseMoyenne: 40,
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.0510, // Proche
                        longitude: 9.7678,
                        timestamp: '2026-02-16T09:15:00.000Z', // Même jour (lundi) et heure à ±1h (9h)
                        vitesseMoyenne: 50,
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.0511,
                        longitude: 9.7679,
                        timestamp: '2026-02-24T08:00:00.000Z', // Échantillon un MARDI → Exclu
                        vitesseMoyenne: 10,
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.2500, // Trop loin (~22km) → Exclu
                        longitude: 9.9500,
                        timestamp: '2026-02-23T08:00:00.000Z',
                        vitesseMoyenne: 45,
                    }),
                },
            ];

            mockFirestore.get.mockResolvedValue({ docs: mockDocs });

            const result = await service.predireTraficPoint(baseLat, baseLng, cibleDate);

            // Seuls les 2 premiers échantillons remplissent les conditions
            // Vitesse moyenne = (40 + 50) / 2 = 45
            expect(result.nombreEchantillons).toBe(2);
            expect(result.vitesseMoyennePredite).toBe(45);
            expect(result.confiance).toBe('faible');
        });
    });

    describe('predireTraficItineraire', () => {
        it('devrait boucler et agréger les prédictions pour tous les points de l\'itinéraire', async () => {
            const points = [
                { latitude: 4.0511, longitude: 9.7679 },
                { latitude: 4.0520, longitude: 9.7690 },
            ];
            mockFirestore.get.mockResolvedValue({ docs: [] });

            const result = await service.predireTraficItineraire(points, new Date());

            expect(result).toHaveLength(2);
            expect(mockFirestore.get).toHaveBeenCalledTimes(2);
        });
    });
});