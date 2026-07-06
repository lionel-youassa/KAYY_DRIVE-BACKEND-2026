import { Test, type TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { RegisterTokenDto } from './dto/register-token.dto';

describe('Notifications (Controller & Service)', () => {
    let controller: NotificationsController;
    let service: NotificationsService;
    let prismaService: PrismaService;
    let firebaseService: FirebaseService;

    // Mock du token utilisateur décodé par le Guard/Décorateur
    const mockUser = { uid: 'user-123' } as DecodedIdToken;

    // Mock des données renvoyées par Prisma
    const mockDbNotification = {
        id: 'notif-abc',
        utilisateurId: 'user-123',
        type: 'incident_proche',
        titre: 'Incident détecté',
        corps: 'Une inondation est signalée à proximité.',
        data: { incidentId: 'inc-999' },
        lu: false,
        dateCreation: new Date('2026-07-06T10:00:00.000Z'),
    };

    const mockDbPosition = {
        id: 'pos-1',
        utilisateurId: 'user-nearby',
        latitude: 4.012,
        longitude: 9.685,
    };

    // Mocks des services externes
    const mockPrismaService = {
        tokenFCM: {
            create: jest.fn(),
            deleteMany: jest.fn(),
            findMany: jest.fn(),
        },
        notification: {
            create: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        positionUtilisateur: {
            findMany: jest.fn(),
        },
    };

    const mockFirebaseService = {
        messaging: {
            send: jest.fn().mockResolvedValue('message-id-123'),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                NotificationsService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: FirebaseService, useValue: mockFirebaseService },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<NotificationsController>(NotificationsController);
        service = module.get<NotificationsService>(NotificationsService);
        prismaService = module.get<PrismaService>(PrismaService);
        firebaseService = module.get<FirebaseService>(FirebaseService);

        jest.clearAllMocks();
    });

    // =========================================================================
    // TESTS DU SERVICE (NotificationsService)
    // =========================================================================
    describe('NotificationsService', () => {

        it('should register a new FCM Token', async () => {
            mockPrismaService.tokenFCM.create.mockResolvedValue({});

            await service.enregistrerTokenFCM('user-123', 'fcm-token-xyz');

            expect(prismaService.tokenFCM.create).toHaveBeenCalledWith({
                data: {
                    utilisateurId: 'user-123',
                    token: 'fcm-token-xyz',
                    dateEnregistrement: expect.any(Date),
                },
            });
        });

        it('should delete an FCM token', async () => {
            mockPrismaService.tokenFCM.deleteMany.mockResolvedValue({ count: 1 });

            await service.supprimerTokenFCM('user-123', 'fcm-token-xyz');

            expect(prismaService.tokenFCM.deleteMany).toHaveBeenCalledWith({
                where: {
                    utilisateurId: 'user-123',
                    token: 'fcm-token-xyz',
                },
            });
        });

        it('should mark a notification as read', async () => {
            mockPrismaService.notification.update.mockResolvedValue({});

            await service.marquerCommeLue('notif-abc');

            expect(prismaService.notification.update).toHaveBeenCalledWith({
                where: { id: 'notif-abc' },
                data: { lu: true },
            });
        });

        it('should fetch user notifications limited to 50 sorted by desc creation', async () => {
            mockPrismaService.notification.findMany.mockResolvedValue([mockDbNotification]);

            const result = await service.getNotificationsUtilisateur('user-123');

            expect(prismaService.notification.findMany).toHaveBeenCalledWith({
                where: { utilisateurId: 'user-123' },
                orderBy: { dateCreation: 'desc' },
                take: 50,
            });
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 'notif-abc',
                id_utilisateur: 'user-123',
                type: 'incident_proche',
                titre: 'Incident détecté',
                corps: 'Une inondation est signalée à proximité.',
                data: { incidentId: 'inc-999' },
                lu: false,
                dateCreation: mockDbNotification.dateCreation.toISOString(),
            });
        });

        describe('notifierUtilisateursProches', () => {
            it('should look up positions and trigger notifications for users within radius', async () => {
                // Mock de la récupération de la position de l'utilisateur à proximité
                mockPrismaService.positionUtilisateur.findMany.mockResolvedValue([mockDbPosition]);

                // Espion avec casting (as any) pour s'affranchir de la restriction stricte du type de retour
                const envoyerNotificationSpy = jest
                    .spyOn(service as any, 'envoyerNotification')
                    .mockResolvedValue(mockDbNotification);

                const notifPayload = {
                    type: 'incident_proche' as const,
                    titre: 'Alerte Danger',
                    corps: 'Une zone est inondée à 100m.',
                };

                // Coordonnées de test proches (Douala)
                const count = await service.notifierUtilisateursProches(4.010, 9.680, 2000, notifPayload);

                expect(prismaService.positionUtilisateur.findMany).toHaveBeenCalled();
                expect(envoyerNotificationSpy).toHaveBeenCalledWith({
                    id_utilisateur: 'user-nearby',
                    ...notifPayload,
                });
                expect(count).toBe(1);
            });

            it('should skip sending notifications if the user is outside the radius', async () => {
                // Position lointaine (ex: Yaoundé par rapport à Douala)
                const farUser = { ...mockDbPosition, latitude: 3.848, longitude: 11.502 };
                mockPrismaService.positionUtilisateur.findMany.mockResolvedValue([farUser]);

                const envoyerNotificationSpy = jest.spyOn(service as any, 'envoyerNotification');

                const count = await service.notifierUtilisateursProches(4.010, 9.680, 2000, {
                    type: 'incident_proche',
                    titre: 'Alerte',
                    corps: 'Test distant',
                });

                expect(envoyerNotificationSpy).not.toHaveBeenCalled();
                expect(count).toBe(0);
            });
        });

        describe('envoyerNotification', () => {
            it('should create notification entry in database and trigger Firebase push notification if tokens exist', async () => {
                mockPrismaService.notification.create.mockResolvedValue(mockDbNotification);
                mockPrismaService.tokenFCM.findMany.mockResolvedValue([{ token: 'fcm-token-abc' }]);

                await service.envoyerNotification({
                    id_utilisateur: 'user-123',
                    type: 'incident_proche',
                    titre: 'Alerte',
                    corps: 'Message',
                    data: { key: 'val' }
                });

                expect(prismaService.notification.create).toHaveBeenCalled();
                expect(prismaService.tokenFCM.findMany).toHaveBeenCalledWith({
                    where: { utilisateurId: 'user-123' },
                });
                expect(firebaseService.messaging.send).toHaveBeenCalledWith({
                    token: 'fcm-token-abc',
                    notification: { title: 'Alerte', body: 'Message' },
                    data: { key: 'val' },
                });
            });
        });
    });

    // =========================================================================
    // TESTS DU CONTRÔLEUR (NotificationsController)
    // =========================================================================
    describe('NotificationsController', () => {

        describe('GET /notifications', () => {
            it('should return all notifications for the authenticated user', async () => {
                const serviceResult = [
                    {
                        id: 'notif-1',
                        id_utilisateur: 'user-123',
                        type: 'systeme' as const,
                        titre: 'Bienvenue',
                        corps: 'Hello',
                        lu: false,
                        dateCreation: '2026-07-06T10:00:00.000Z',
                    },
                ];
                jest.spyOn(service, 'getNotificationsUtilisateur').mockResolvedValue(serviceResult);

                const result = await controller.getNotifications(mockUser);

                expect(service.getNotificationsUtilisateur).toHaveBeenCalledWith('user-123');
                expect(result).toEqual({ notifications: serviceResult });
            });
        });

        describe('POST /notifications/token', () => {
            it('should successfully register a device FCM token', async () => {
                jest.spyOn(service, 'enregistrerTokenFCM').mockResolvedValue(undefined as any);
                const dto: RegisterTokenDto = { token: 'fcm-client-token-999' };

                const result = await controller.registerToken(dto, mockUser);

                expect(service.enregistrerTokenFCM).toHaveBeenCalledWith('user-123', 'fcm-client-token-999');
                expect(result).toEqual({ success: true });
            });
        });

        describe('PATCH /notifications/:id/lue', () => {
            it('should mark the specified notification as read', async () => {
                jest.spyOn(service, 'marquerCommeLue').mockResolvedValue(undefined as any);

                const result = await controller.marquerLue('notif-abc');

                expect(service.marquerCommeLue).toHaveBeenCalledWith('notif-abc');
                expect(result).toEqual({ success: true });
            });
        });
    });
});