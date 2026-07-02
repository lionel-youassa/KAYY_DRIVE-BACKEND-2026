import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RegisterTokenDto } from './dto/register-token.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('NotificationsController', () => {
    let controller: NotificationsController;
    let service: NotificationsService;

    // Utilisateur fictif connecté
    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'user-fcm-123',
        email: 'user@kayydrive.cm',
    };

    const mockNotifications = [
        {
            id: 'notif-1',
            id_utilisateur: 'user-fcm-123',
            type: 'incident_proche' as const,
            titre: 'Inondation',
            corps: 'Route inondée',
            lu: false,
            dateCreation: new Date().toISOString(),
        },
    ];

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NotificationsController],
            providers: [
                {
                    provide: NotificationsService,
                    useValue: {
                        getNotificationsUtilisateur: jest.fn(),
                        enregistrerTokenFCM: jest.fn(),
                        marquerCommeLue: jest.fn(),
                    },
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<NotificationsController>(NotificationsController);
        service = module.get<NotificationsService>(NotificationsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /notifications', () => {
        it('devrait retourner la liste des notifications de l utilisateur connecté', async () => {
            jest.spyOn(service, 'getNotificationsUtilisateur').mockResolvedValue(mockNotifications);

            const result = await controller.getNotifications(mockFirebaseUser as DecodedIdToken);

            expect(service.getNotificationsUtilisateur).toHaveBeenCalledWith(mockFirebaseUser.uid);
            expect(result).toEqual({ notifications: mockNotifications });
        });
    });

    describe('POST /notifications/token', () => {
        it('devrait enregistrer le token FCM pour l utilisateur connecté', async () => {
            const dto: RegisterTokenDto = { token: 'fcm-token-string-xyz' };
            jest.spyOn(service, 'enregistrerTokenFCM').mockResolvedValue(undefined);

            const result = await controller.registerToken(dto, mockFirebaseUser as DecodedIdToken);

            expect(service.enregistrerTokenFCM).toHaveBeenCalledWith(mockFirebaseUser.uid, dto.token);
            expect(result).toEqual({ success: true });
        });
    });

    describe('PATCH /notifications/:id/lue', () => {
        it('devrait marquer une notification spécifique comme lue', async () => {
            jest.spyOn(service, 'marquerCommeLue').mockResolvedValue(undefined);

            const result = await controller.marquerLue('notif-1');

            expect(service.marquerCommeLue).toHaveBeenCalledWith('notif-1');
            expect(result).toEqual({ success: true });
        });
    });
});