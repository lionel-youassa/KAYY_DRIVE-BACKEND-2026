import { Test, TestingModule } from '@nestjs/testing';
import { PredictionsService } from './predictions.service';
import { FirebaseService } from '../firebase/firebase.service';

describe('PredictionsService', () => {
    let service: PredictionsService;

    // Création d'un mock pour Firebase Firestore Fluent API
    const mockFirestore = {
        collection: jest.fn().mockReturnThis(),
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
        const baseLat = 4.0511; // Coordonnées cibles (Douala)
        const baseLng = 9.7679;
        // Lundi 2 mars 2026 à 08:30:00 (Jour de la semaine = 1, Heure = 8)
        const cibleDate = new Date('2026-03-02T08:30:00.000Z');

        it('devrait renvoyer un statut "fluide" par défaut s il n y a aucun échantillon dans Firestore', async () => {
            mockFirestore.get.mockResolvedValue({ docs: [] });

            const result = await service.predireTraficPoint(baseLat, baseLng, cibleDate);

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

        it('devrait filtrer les échantillons par géolocalisation, jour et heure, puis calculer la moyenne', async () => {
            const mockDocs = [
                {
                    data: () => ({
                        latitude: 4.0512, // Très proche (~15m)
                        longitude: 9.7680,
                        timestamp: '2026-02-23T08:15:00.000Z', // Lundi précédent, à ±1h d'intervalle
                        vitesseMoyenne: 40,
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.0510, // Très proche
                        longitude: 9.7678,
                        timestamp: '2026-02-16T09:15:00.000Z', // Il y a deux lundis, à ±1h d'intervalle
                        vitesseMoyenne: 50,
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.0511,
                        longitude: 9.7679,
                        timestamp: '2026-02-24T08:00:00.000Z', // Échantillon un MARDI → Doit être ignoré
                        vitesseMoyenne: 10,
                    }),
                },
                {
                    data: () => ({
                        latitude: 4.2500, // Trop loin (~22km) → Doit être ignoré
                        longitude: 9.9500,
                        timestamp: '2026-02-23T08:00:00.000Z',
                        vitesseMoyenne: 45,
                    }),
                },
            ];

            mockFirestore.get.mockResolvedValue({ docs: mockDocs });

            const result = await service.predireTraficPoint(baseLat, baseLng, cibleDate);

            // Seuls les 2 premiers échantillons sont pertinents
            // Vitesse moyenne = (40 + 50) / 2 = 45 km/h
            expect(result.nombreEchantillons).toBe(2);
            expect(result.vitesseMoyennePredite).toBe(45);
            expect(result.confiance).toBe('faible'); // < 5 échantillons = 'faible'
        });
    });

    describe('predireTraficItineraire', () => {
        it('devrait boucler sur chaque coordonnée et agréger les prédictions du parcours', async () => {
            const points = [
                { latitude: 4.0511, longitude: 9.7679 },
                { latitude: 4.0520, longitude: 9.7690 },
            ];
            const cibleDate = new Date('2026-03-02T10:00:00.000Z');

            // On simule un retour vide de Firestore pour chaque itération du parcours
            mockFirestore.get.mockResolvedValue({ docs: [] });

            const result = await service.predireTraficItineraire(points, cibleDate);

            expect(result).toHaveLength(2);
            expect(result[0].latitude).toBe(4.0511);
            expect(result[1].latitude).toBe(4.0520);
            expect(mockFirestore.get).toHaveBeenCalledTimes(2);
        });
    });
});