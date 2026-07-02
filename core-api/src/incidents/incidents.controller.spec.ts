import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsController } from './incidents.controller';
import IncidentsService from './incidents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ConfirmIncidentDto } from './dto/confirm-incident.dto';
import type { DecodedIdToken } from 'firebase-admin/auth';

describe('IncidentsController', () => {
    let controller: IncidentsController;
    let incidentsService: IncidentsService;
    let notificationsService: NotificationsService;

    const mockFirebaseUser: Partial<DecodedIdToken> = {
        uid: 'user-firebase-123',
        email: 'test@kayydrive.cm',
    };

    const mockIncident = {
        id: 'incident-uuid-999',
        type: 'inondation',
        description: 'Grosse flaque bloquant la chaussée',
        latitude: 4.0511,
        longitude: 9.7679,
        id_utilisateur_createur: 'user-firebase-123',
        statut: 'non_confirme',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [IncidentsController],
            providers: [
                {
                    provide: IncidentsService,
                    useValue: {
                        getIncidentsProches: jest.fn(),
                        createIncident: jest.fn(),
                        confirmerIncident: jest.fn(),
                    },
                },
                {
                    provide: NotificationsService,
                    useValue: {
                        notifierUtilisateursProches: jest.fn().mockResolvedValue(true),
                    },
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<IncidentsController>(IncidentsController);
        incidentsService = module.get<IncidentsService>(IncidentsService);
        notificationsService = module.get<NotificationsService>(NotificationsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /incidents', () => {
        it('devrait retourner les incidents proches en parsant correctement les Query Params', async () => {
            jest.spyOn(incidentsService, 'getIncidentsProches').mockResolvedValue([mockIncident] as any);

            const result = await controller.getIncidents('4.0511', '9.7679', '2000');

            expect(incidentsService.getIncidentsProches).toHaveBeenCalledWith(4.0511, 9.7679, 2000);
            expect(result).toEqual({ incidents: [mockIncident] });
        });

        it('devrait utiliser undefined pour le rayon s il n est pas fourni', async () => {
            jest.spyOn(incidentsService, 'getIncidentsProches').mockResolvedValue([] as any);

            await controller.getIncidents('4.0511', '9.7679', undefined);

            expect(incidentsService.getIncidentsProches).toHaveBeenCalledWith(4.0511, 9.7679, undefined);
        });
    });

    describe('POST /incidents', () => {
        it('devrait créer un incident et lancer la notification d arrière-plan à proximité', async () => {
            const dto: CreateIncidentDto = {
                type: 'inondation',
                description: 'Route inondée suite aux fortes pluies',
                latitude: 4.0511,
                longitude: 9.7679,
            };

            jest.spyOn(incidentsService, 'createIncident').mockResolvedValue(mockIncident as any);

            const result = await controller.createIncident(dto, mockFirebaseUser as DecodedIdToken);

            expect(incidentsService.createIncident).toHaveBeenCalledWith({
                type: dto.type,
                description: dto.description,
                latitude: dto.latitude,
                longitude: dto.longitude,
                id_utilisateur_createur: mockFirebaseUser.uid,
            });

            expect(notificationsService.notifierUtilisateursProches).toHaveBeenCalledWith(
                dto.latitude,
                dto.longitude,
                2000,
                expect.objectContaining({
                    type: 'incident_proche',
                    titre: 'Inondation signalée près de vous',
                })
            );
            expect(result).toEqual({ success: true, incident: mockIncident });
        });
    });

    describe('POST /incidents/:id/confirmer', () => {
        it('devrait appeler le service pour incrémenter la confirmation d un incident', async () => {
            // @ts-ignore
            const dto: ConfirmIncidentDto = { type_vote: 'confirmation' };
            jest.spyOn(incidentsService, 'confirmerIncident').mockResolvedValue({ ...mockIncident, statut: 'confirme' } as any);

            const result = await controller.confirmer('incident-uuid-999', dto, mockFirebaseUser as DecodedIdToken);

            expect(incidentsService.confirmerIncident).toHaveBeenCalledWith(
                'incident-uuid-999',
                mockFirebaseUser.uid,
                'confirmation'
            );
            expect(result).toEqual({ success: true, incident: { ...mockIncident, statut: 'confirme' } });
        });
    });
});