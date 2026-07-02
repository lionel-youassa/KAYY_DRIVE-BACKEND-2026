import { Test, TestingModule } from '@nestjs/testing';
import { SafeDriveService, SAFE_DRIVE_QUEUE, SecousseData } from './safe-drive.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('SafeDriveService', () => {
    let service: SafeDriveService;

    // Mock complet de la file d'attente BullMQ (Queue)
    const mockQueue = {
        add: jest.fn().mockResolvedValue({ id: 'job-id-123' }),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SafeDriveService,
                {
                    // Utilisation de getQueueToken pour injecter notre mock à la place de la vraie queue BullMQ
                    provide: getQueueToken(SAFE_DRIVE_QUEUE),
                    useValue: mockQueue,
                },
            ],
        }).compile();

        service = module.get<SafeDriveService>(SafeDriveService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('ajouterSecousse', () => {
        it('devrait ajouter correctement la lecture de secousse dans la file BullMQ avec les options de retry', async () => {
            const data: SecousseData = {
                id_utilisateur: 'user-safe-driver-xyz',
                latitude: 4.0511,
                longitude: 9.7679,
                intensite: 4.2,
                timestamp: '2026-03-02T15:30:00.000Z',
            };

            await service.ajouterSecousse(data);

            // Vérification que BullMQ a reçu le bon nom d'événement, les données et les options de backoff/nettoyage
            expect(mockQueue.add).toHaveBeenCalledWith(
                'nouvelle-secousse',
                data,
                {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 1000 },
                    removeOnComplete: 1000,
                    removeOnFail: 5000,
                },
            );
        });
    });
});