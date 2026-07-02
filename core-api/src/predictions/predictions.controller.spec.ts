import { Test, TestingModule } from '@nestjs/testing';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { BadRequestException } from '@nestjs/common';
import { ItineraireDto } from './dto/itineraire.dto';

describe('PredictionsController', () => {
    let controller: PredictionsController;
    let service: PredictionsService;

    const mockPredictionPoint = {
        latitude: 4.0511,
        longitude: 9.7679,
        jourSemaine: 1,
        heure: 8,
        niveauPredit: 'fluide',
        vitesseMoyennePredite: 45,
        confiance: 'haute',
        nombreEchantillons: 12,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [PredictionsController],
            providers: [
                {
                    provide: PredictionsService,
                    useValue: {
                        predireTraficPoint: jest.fn(),
                        predireTraficItineraire: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<PredictionsController>(PredictionsController);
        service = module.get<PredictionsService>(PredictionsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /predictions (predictionPoint)', () => {
        it('devrait appeler le service avec les coordonnées flottantes et la date parsée', async () => {
            jest.spyOn(service, 'predireTraficPoint').mockResolvedValue(mockPredictionPoint as any);
            const horodatage = '2026-03-02T08:00:00.000Z';

            const result = await controller.predictionPoint('4.0511', '9.7679', horodatage);

            expect(service.predireTraficPoint).toHaveBeenCalledWith(
                4.0511,
                9.7679,
                new Date(horodatage),
            );
            expect(result).toEqual({ prediction: mockPredictionPoint });
        });

        it('devrait utiliser la date actuelle du système si l horodatage est undefined', async () => {
            jest.spyOn(service, 'predireTraficPoint').mockResolvedValue(mockPredictionPoint as any);

            await controller.predictionPoint('4.0511', '9.7679', undefined);

            expect(service.predireTraficPoint).toHaveBeenCalledWith(
                4.0511,
                9.7679,
                expect.any(Date), // Permet d'éviter de tester la milliseconde exacte de new Date()
            );
        });

        it('devrait lever une exception BadRequestException si l horodatage est invalide', async () => {
            await expect(
                controller.predictionPoint('4.0511', '9.7679', 'date-invalide'),
            ).rejects.toThrow(BadRequestException);

            expect(service.predireTraficPoint).not.toHaveBeenCalled();
        });
    });

    describe('POST /predictions/itineraire (predictionItineraire)', () => {
        it('devrait analyser un itinéraire complet à partir du DTO', async () => {
            const dto: ItineraireDto = {
                points: [
                    { latitude: 4.0511, longitude: 9.7679 },
                    { latitude: 4.0520, longitude: 9.7690 },
                ],
                horodatage: '2026-03-02T12:00:00.000Z',
            };

            jest.spyOn(service, 'predireTraficItineraire').mockResolvedValue([mockPredictionPoint] as any);

            const result = await controller.predictionItineraire(dto);

            // Le cast "as string" indique à TypeScript que la surcharge attendue est valide ici
            expect(service.predireTraficItineraire).toHaveBeenCalledWith(
                dto.points,
                new Date(dto.horodatage as string),
            );
            expect(result).toEqual({ predictions: [mockPredictionPoint] });
        });

        it('devrait utiliser la date actuelle si l horodatage du DTO n est pas spécifié', async () => {
            const dto: ItineraireDto = {
                points: [{ latitude: 4.0511, longitude: 9.7679 }],
                horodatage: undefined,
            };

            jest.spyOn(service, 'predireTraficItineraire').mockResolvedValue([mockPredictionPoint] as any);

            await controller.predictionItineraire(dto);

            expect(service.predireTraficItineraire).toHaveBeenCalledWith(
                dto.points,
                expect.any(Date),
            );
        });

        it('devrait rejeter la requête si l horodatage du DTO est invalide', async () => {
            const dto: ItineraireDto = {
                points: [{ latitude: 4.0511, longitude: 9.7679 }],
                horodatage: 'invalid-date',
            };

            await expect(controller.predictionItineraire(dto)).rejects.toThrow(BadRequestException);
        });
    });
});