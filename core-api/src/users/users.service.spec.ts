import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
    let service: UsersService;
    let prisma: PrismaService;

    // Mock pour PrismaClient
    const mockPrisma = {
        positionUtilisateur: {
            upsert: jest.fn(),
            delete: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UsersService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<UsersService>(UsersService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('mettreAJourPosition', () => {
        it('devrait appeler prisma.positionUtilisateur.upsert avec les bons critères et injecter une Date', async () => {
            const uid = 'user-driver-456';
            const lat = 4.0511;
            const lng = 9.7679;

            mockPrisma.positionUtilisateur.upsert.mockResolvedValue({});

            await service.mettreAJourPosition(uid, lat, lng);

            expect(prisma.positionUtilisateur.upsert).toHaveBeenCalledWith({
                where: { utilisateurId: uid },
                update: {
                    latitude: lat,
                    longitude: lng,
                    derniereMiseAJour: expect.any(Date),
                },
                create: {
                    utilisateurId: uid,
                    latitude: lat,
                    longitude: lng,
                    derniereMiseAJour: expect.any(Date),
                },
            });
        });
    });

    describe('supprimerPosition', () => {
        it('devrait appeler prisma.positionUtilisateur.delete pour l\'utilisateur cible', async () => {
            const uid = 'user-driver-456';

            mockPrisma.positionUtilisateur.delete.mockResolvedValue({});

            await service.supprimerPosition(uid);

            expect(prisma.positionUtilisateur.delete).toHaveBeenCalledWith({
                where: { utilisateurId: uid },
            });
        });
    });
});