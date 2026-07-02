import { Test, TestingModule } from '@nestjs/testing';
import { RewardsService } from './rewards.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('RewardsService', () => {
    let service: RewardsService;
    let prisma: PrismaService;

    // Mock pour l'entité recompense de Prisma
    const mockPrisma = {
        recompense: {
            create: jest.fn(),
            findMany: jest.fn(),
            delete: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RewardsService,
                {
                    provide: PrismaService,
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<RewardsService>(RewardsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createReward', () => {
        it('devrait insérer et retourner la récompense créée avec succès', async () => {
            const inputData = { nom: 'Lavage Auto', pointsRequis: 50 };
            const expectedOutput = { id: 'r1', ...inputData };

            mockPrisma.recompense.create.mockResolvedValue(expectedOutput);

            const result = await service.createReward(inputData);

            expect(prisma.recompense.create).toHaveBeenCalledWith({
                data: inputData,
            });
            expect(result).toEqual(expectedOutput);
        });

        it('devrait lever une HttpException de type BAD_REQUEST en cas de rejet par Prisma', async () => {
            mockPrisma.recompense.create.mockRejectedValue(new Error('Prisma error'));

            await expect(service.createReward({})).rejects.toThrow(
                new HttpException('Impossible de créer la récompense', HttpStatus.BAD_REQUEST),
            );
        });
    });

    describe('getAllRewards', () => {
        it('devrait retourner toutes les récompenses trouvées', async () => {
            const mockRewards = [{ id: '1', nom: 'R1' }, { id: '2', nom: 'R2' }];
            mockPrisma.recompense.findMany.mockResolvedValue(mockRewards);

            const result = await service.getAllRewards();

            expect(prisma.recompense.findMany).toHaveBeenCalled();
            expect(result).toEqual(mockRewards);
        });

        it('devrait retourner un tableau vide si findMany lève une exception (sécurité Flutter)', async () => {
            mockPrisma.recompense.findMany.mockRejectedValue(new Error('Database Timeout'));

            const result = await service.getAllRewards();

            expect(result).toEqual([]);
        });
    });

    describe('deleteReward', () => {
        it('devrait supprimer la récompense via son identifiant', async () => {
            const mockDeleted = { id: 'reward-id', nom: 'Café gratuit' };
            mockPrisma.recompense.delete.mockResolvedValue(mockDeleted);

            const result = await service.deleteReward('reward-id');

            expect(prisma.recompense.delete).toHaveBeenCalledWith({
                where: { id: 'reward-id' },
            });
            expect(result).toEqual(mockDeleted);
        });

        it('devrait lever une HttpException de type NOT_FOUND si l\'enregistrement n\'existe pas', async () => {
            mockPrisma.recompense.delete.mockRejectedValue(new Error('Record not found'));

            await expect(service.deleteReward('id-inexistant')).rejects.toThrow(
                new HttpException('Impossible de supprimer la récompense', HttpStatus.NOT_FOUND),
            );
        });
    });
});