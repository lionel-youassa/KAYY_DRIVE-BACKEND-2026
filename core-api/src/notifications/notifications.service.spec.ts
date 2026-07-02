import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';

describe('NotificationsService', () => {
    let service: NotificationsService;
    let prisma: PrismaService;
    let firebase: FirebaseService;

    // Mock pour Firebase Messaging
    const mockMessaging = {
        send: jest.fn().mockResolvedValue('message-id-123'),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NotificationsService,
                {
                    provide: PrismaService,
                    useValue: {
                        tokenFCM: {
                            create: jest.fn(),
                            deleteMany: jest.fn(),
                            findMany: jest.fn(),
                        },
                        notification: {
                            create: jest.fn(),
                            update: jest.fn(),
                            findMany: jest.fn(),
                        },
                        positionUtilisateur: {
                            findMany: jest.fn(),
                        },
                    },
                },
                {
                    provide: FirebaseService,
                    useValue: {
                        messaging: mockMessaging,
                    },
                },
            ],
        }).compile();

        service = module.get<NotificationsService>(NotificationsService);
        prisma = module.get<PrismaService>(PrismaService);
        firebase = module.get<FirebaseService>(FirebaseService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('enregistrerTokenFCM', () => {
        it('devrait insérer un nouveau token FCM dans la base de données', async () => {
            await service.enregistrerTokenFCM('user-1', 'token-abc');

            expect(prisma.tokenFCM.create).toHaveBeenCalledWith({
                data: {
                    utilisateurId: 'user-1',
                    token: 'token-abc',
                    dateEnregistrement: expect.any(Date),
                },
            });
        });
    });

    describe('supprimerTokenFCM', () => {
        it('devrait supprimer les tokens FCM cibles', async () => {
            await service.supprimerTokenFCM('user-1', 'token-abc');

            expect(prisma.tokenFCM.deleteMany).toHaveBeenCalledWith({
                where: { utilisateurId: 'user-1', token: 'token-abc' },
            });
        });
    });

    describe('marquerCommeLue', () => {
        it('devrait mettre à jour le statut "lu" d une notification à true', async () => {
            await service.marquerCommeLue('notif-id');

            expect(prisma.notification.update).toHaveBeenCalledWith({
                where: { id: 'notif-id' },
                data: { lu: true },
            });
        });
    });

    describe('getNotificationsUtilisateur', () => {
        it('devrait retourner les notifications triées et formatées pour l utilisateur', async () => {
            const mockDbNotifications = [
                {
                    id: 'n1',
                    utilisateurId: 'user-1',
                    type: 'systeme',
                    titre: 'Hello',
                    corps: 'World',
                    data: { key: 'val' },
                    lu: false,
                    dateCreation: new Date('2026-01-01'),
                },
            ];

            jest.spyOn(prisma.notification, 'findMany').mockResolvedValue(mockDbNotifications as any);

            const result = await service.getNotificationsUtilisateur('user-1');

            expect(prisma.notification.findMany).toHaveBeenCalledWith({
                where: { utilisateurId: 'user-1' },
                orderBy: { dateCreation: 'desc' },
                take: 50,
            });
            expect(result).toEqual([
                {
                    id: 'n1',
                    id_utilisateur: 'user-1',
                    type: 'systeme',
                    titre: 'Hello',
                    corps: 'World',
                    data: { key: 'val' },
                    lu: false,
                    dateCreation: mockDbNotifications[0].dateCreation.toISOString(),
                },
            ]);
        });
    });

    describe('envoyerNotification', () => {
        it('devrait sauvegarder la notification et envoyer un push FCM si des tokens existent', async () => {
            const notifInput = {
                id_utilisateur: 'user-1',
                type: 'incident_proche' as const,
                titre: 'Attention',
                corps: 'Danger',
                data: { test: '123' },
            };

            jest.spyOn(prisma.notification, 'create').mockResolvedValue({ id: 'generated-notif-id' } as any);
            jest.spyOn(prisma.tokenFCM, 'findMany').mockResolvedValue([{ token: 'token-user-1' }] as any);

            await service.envoyerNotification(notifInput);

            expect(prisma.notification.create).toHaveBeenCalled();
            expect(prisma.tokenFCM.findMany).toHaveBeenCalledWith({ where: { utilisateurId: 'user-1' } });
            expect(mockMessaging.send).toHaveBeenCalledWith({
                token: 'token-user-1',
                notification: { title: 'Attention', body: 'Danger' },
                data: { test: '123', notificationId: 'generated-notif-id', type: 'incident_proche' },
            });
        });
    });

    describe('notifierUtilisateursProches (Calcul Haversine)', () => {
        it('devrait uniquement notifier les utilisateurs situés à l intérieur du rayon donné', async () => {
            const baseLat = 4.0511; // Douala
            const baseLng = 9.7679;

            const mockPositions = [
                { utilisateurId: 'user-proche', latitude: 4.0515, longitude: 9.7680 }, // Très proche (< 100m)
                { utilisateurId: 'user-lointain', latitude: 4.1500, longitude: 9.9000 }, // Très loin (~18km)
            ];

            jest.spyOn(prisma.positionUtilisateur, 'findMany').mockResolvedValue(mockPositions as any);
            // Espionner la méthode interne envoyerNotification pour ne pas déclencher FCM
            // @ts-ignore
            const envoyerSpy = jest.spyOn(service, 'envoyerNotification').mockResolvedValue(undefined);

            const totalNotified = await service.notifierUtilisateursProches(baseLat, baseLng, 2000, {
                type: 'incident_proche',
                titre: 'Alerte',
                corps: 'Inondation imminente',
            });

            // L'utilisateur lointain doit être exclu par la formule mathématique
            expect(totalNotified).toBe(1);
            expect(envoyerSpy).toHaveBeenCalledTimes(1);
            expect(envoyerSpy).toHaveBeenCalledWith(
                expect.objectContaining({ id_utilisateur: 'user-proche' })
            );
        });
    });
});