import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ExecutionContext } from '@nestjs/common';

describe('Users (Controller & Service)', () => {
    let controller: UsersController;
    let service: UsersService;
    let prismaService: PrismaService;

    // Mock de PrismaService
    const mockPrismaService = {
        positionUtilisateur: {
            upsert: jest.fn(),
            delete: jest.fn(),
        },
    };

    // Mock du AuthGuard pour autoriser l'accès aux routes du contrôleur
    const mockAuthGuard = {
        canActivate: jest.fn((context: ExecutionContext) => true),
    };

    // Objet utilisateur factice injecté par @CurrentUser()
    const mockUser = { uid: 'user-uid-123' };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
            providers: [
                UsersService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue(mockAuthGuard)
            .compile();

        controller = module.get<UsersController>(UsersController);
        service = module.get<UsersService>(UsersService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
        expect(service).toBeDefined();
    });

    describe('UsersService', () => {
        it('mettreAJourPosition -> devrait appeler prisma.positionUtilisateur.upsert', async () => {
            mockPrismaService.positionUtilisateur.upsert.mockResolvedValue({});

            await service.mettreAJourPosition('user-uid-123', 4.05, 9.7);

            expect(mockPrismaService.positionUtilisateur.upsert).toHaveBeenCalledWith({
                where: { utilisateurId: 'user-uid-123' },
                update: {
                    latitude: 4.05,
                    longitude: 9.7,
                    derniereMiseAJour: expect.any(Date),
                },
                create: {
                    utilisateurId: 'user-uid-123',
                    latitude: 4.05,
                    longitude: 9.7,
                    derniereMiseAJour: expect.any(Date),
                },
            });
        });

        it('supprimerPosition -> devrait appeler prisma.positionUtilisateur.delete', async () => {
            mockPrismaService.positionUtilisateur.delete.mockResolvedValue({});

            await service.supprimerPosition('user-uid-123');

            expect(mockPrismaService.positionUtilisateur.delete).toHaveBeenCalledWith({
                where: { utilisateurId: 'user-uid-123' },
            });
        });
    });

    describe('UsersController', () => {
        it('POST /users/position -> devrait appeler service.mettreAJourPosition et retourner success', async () => {
            const serviceSpy = jest.spyOn(service, 'mettreAJourPosition').mockResolvedValue();
            const dto = { latitude: 4.05, longitude: 9.7 };

            const result = await controller.updatePosition(dto, mockUser as any);

            expect(serviceSpy).toHaveBeenCalledWith('user-uid-123', 4.05, 9.7);
            expect(result).toEqual({ success: true });
        });

        it('DELETE /users/position -> devrait appeler service.supprimerPosition et retourner success', async () => {
            const serviceSpy = jest.spyOn(service, 'supprimerPosition').mockResolvedValue();

            const result = await controller.deletePosition(mockUser as any);

            expect(serviceSpy).toHaveBeenCalledWith('user-uid-123');
            expect(result).toEqual({ success: true });
        });
    });
});