import { Test, type TestingModule } from '@nestjs/testing';
import { SafeDriveController } from './safe-drive.controller';
import { SafeDriveService, SAFE_DRIVE_QUEUE } from './safe-drive.service';
import { SafeDriveProcessor } from './safe-drive.processor';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { getQueueToken } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { SecousseDto } from './dto/secousse.dto';

describe('SafeDrive (Controller, Service & Processor)', () => {
    let controller: SafeDriveController;
    let service: SafeDriveService;
    let processor: SafeDriveProcessor;
    let prismaService: PrismaService;

    // Mock de la file d'attente BullMQ
    const mockQueue = {
        add: jest.fn(),
    };

    // Mock de PrismaService
    const mockPrismaService = {
        secousseData: {
            create: jest.fn(),
        },
        incident: {
            create: jest.fn(),
        },
    };

    // Mock de l'utilisateur connecté
    const mockUser = { uid: 'user-456' } as DecodedIdToken;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [SafeDriveController],
            providers: [
                SafeDriveService,
                SafeDriveProcessor,
                { provide: getQueueToken(SAFE_DRIVE_QUEUE), useValue: mockQueue },
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: () => true })
            .compile();

        controller = module.get<SafeDriveController>(SafeDriveController);
        service = module.get<SafeDriveService>(SafeDriveService);
        processor = module.get<SafeDriveProcessor>(SafeDriveProcessor);
        prismaService = module.get<PrismaService>(PrismaService);

        jest.clearAllMocks();
    });

    // =========================================================================
    // 1. TESTS DU CONTRÔLEUR & DU SERVICE (Ajout à la file d'attente)
    // =========================================================================
    describe('SafeDriveController & Service (Ingestion)', () => {
        it('should push a shake record into the BullMQ queue via the controller', async () => {
            const dto: SecousseDto = {
                latitude: 4.012,
                longitude: 9.678,
                intensite: 12.5,
            };

            mockQueue.add.mockResolvedValue({ id: 'job-1' });

            const response = await controller.secousse(dto, mockUser);

            // Vérifie l'appel à la file BullMQ sous-jacente
            expect(mockQueue.add).toHaveBeenCalledWith(
                'nouvelle-secousse',
                {
                    id_utilisateur: mockUser.uid,
                    latitude: dto.latitude,
                    longitude: dto.longitude,
                    intensite: dto.intensite,
                    timestamp: expect.any(String),
                },
                expect.any(Object),
            );

            expect(response).toEqual({
                success: true,
                message: 'Donnée reçue et mise en file',
            });
        });
    });

    // =========================================================================
    // 2. TESTS DU PROCESSOR (Traitement asynchrone des jobs)
    // =========================================================================
    describe('SafeDriveProcessor (Worker)', () => {
        it('should save raw shake data to database but NOT create an incident if intensity is below threshold', async () => {
            const mockJob = {
                data: {
                    id_utilisateur: 'user-456',
                    latitude: 4.012,
                    longitude: 9.678,
                    intensite: 8.0, // < 15 (Seuil d'intensité anormale)
                    timestamp: '2026-07-06T11:00:00.000Z',
                },
            } as Job;

            mockPrismaService.secousseData.create.mockResolvedValue({});

            const result = await processor.process(mockJob);

            // Devrait enregistrer la secousse brute
            expect(prismaService.secousseData.create).toHaveBeenCalledWith({
                data: {
                    id_utilisateur: 'user-456',
                    latitude: 4.012,
                    longitude: 9.678,
                    intensite: 8.0,
                    timestamp: new Date('2026-07-06T11:00:00.000Z'),
                    traite: true,
                },
            });

            // Ne devrait pas générer d'incident de trafic majeur
            expect(prismaService.incident.create).not.toHaveBeenCalled();
            expect(result).toEqual({ traite: true });
        });

        it('should save raw shake data AND automatically trigger an incident report if intensity is high', async () => {
            const mockJob = {
                data: {
                    id_utilisateur: 'user-456',
                    latitude: 4.012,
                    longitude: 9.678,
                    intensite: 18.5, // >= 15 (Seuil d'intensité anormale)
                    timestamp: '2026-07-06T11:00:00.000Z',
                },
            } as Job;

            mockPrismaService.secousseData.create.mockResolvedValue({});
            mockPrismaService.incident.create.mockResolvedValue({});

            const result = await processor.process(mockJob);

            // Enregistrement brut systématique
            expect(prismaService.secousseData.create).toHaveBeenCalled();

            // Création automatique de l'incident de trafic/chaussée
            expect(prismaService.incident.create).toHaveBeenCalledWith({
                data: {
                    type: 'TRAFIC',
                    description: 'Secousse anormale détectée (intensité: 18.5)',
                    latitude: 4.012,
                    longitude: 9.678,
                    idRapporteur: 'user-456',
                    id_utilisateur_createur: 'user-456',
                    statut: 'non_confirme',
                    nombreConfirmations: 1,
                    confirmePar: ['user-456'],
                    horodatage: expect.any(Date),
                },
            });

            expect(result).toEqual({ traite: true });
        });
    });
});