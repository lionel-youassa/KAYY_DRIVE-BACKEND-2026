import { Test, TestingModule } from '@nestjs/testing';
import { RewardsService } from './rewards.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('RewardsService', () => {
    let service: RewardsService;
    let prismaService: PrismaService;

    const mockPrismaService = {
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
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<RewardsService>(RewardsService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createReward', () => {
        it('should format points to integer and dates to Date objects', async () => {
            const inputData = {
                titre: 'Café Gratuit',
                points: '50',
                dateDebut: '2026-07-01',
                dateFin: '2026-07-31',
            };

            const expectedPrismaCall = {
                data: {
                    titre: 'Café Gratuit',
                    points: 50,
                    dateDebut: new Date('2026-07-01'),
                    dateFin: new Date('2026-07-31'),
                },
            };

            mockPrismaService.recompense.create.mockResolvedValue({ id: 'r1', ...expectedPrismaCall.data });

            const result = await service.createReward(inputData);

            expect(mockPrismaService.recompense.create).toHaveBeenCalledWith(expectedPrismaCall);
            expect(result).toHaveProperty('id', 'r1');
            expect(result.points).toBe(50);
        });

        it('should fallback to 0 points and current dates if not provided', async () => {
            mockPrismaService.recompense.create.mockImplementation(({ data }) => Promise.resolve({ id: 'r2', ...data }));

            const result = await service.createReward({ titre: 'Surprise' });

            expect(result.points).toBe(0);
            expect(result.dateDebut).toBeInstanceOf(Date);
            expect(result.dateFin).toBeInstanceOf(Date);
        });

        it('should throw an HttpException if prisma creation fails', async () => {
            mockPrismaService.recompense.create.mockRejectedValue(new Error('Prisma error'));

            await expect(service.createReward({})).rejects.toThrow(
                new HttpException('Impossible de créer la récompense', HttpStatus.BAD_REQUEST),
            );
        });
    });

    describe('getAllRewards', () => {
        it('should return an array of rewards', async () => {
            const mockRewards = [{ id: '1', titre: 'R1' }, { id: '2', titre: 'R2' }];
            mockPrismaService.recompense.findMany.mockResolvedValue(mockRewards);

            const result = await service.getAllRewards();

            expect(result).toEqual(mockRewards);
        });

        it('should return an empty array if prisma fails', async () => {
            mockPrismaService.recompense.findMany.mockRejectedValue(new Error('Database offline'));

            const result = await service.getAllRewards();

            expect(result).toEqual([]);
        });
    });

    describe('deleteReward', () => {
        it('should delete a reward by id', async () => {
            mockPrismaService.recompense.delete.mockResolvedValue({ id: '1' });

            const result = await service.deleteReward('1');

            expect(mockPrismaService.recompense.delete).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(result).toBeDefined();
        });

        it('should throw an HttpException if deletion fails', async () => {
            mockPrismaService.recompense.delete.mockRejectedValue(new Error('Not found'));

            await expect(service.deleteReward('invalid-id')).rejects.toThrow(
                new HttpException('Impossible de supprimer la récompense', HttpStatus.NOT_FOUND),
            );
        });
    });
});