import { Test, TestingModule } from '@nestjs/testing';
import { AdsService } from './ads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AdsService', () => {
    let service: AdsService;
    let prismaService: PrismaService;

    const mockPrismaService = {
        publicite: {
            create: jest.fn(),
            findMany: jest.fn(),
            delete: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdsService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<AdsService>(AdsService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createAdvertising', () => {
        it('should format dates and omit mediaPath when creating an ad', async () => {
            const inputData = {
                titre: 'Promo Été',
                mediaPath: 'ignored_path.jpg',
                imageUrl: 'http://storage/ads/pic.jpg',
                dateDebut: '2026-07-01',
                dateFin: '2026-07-31',
            };

            const expectedPrismaCall = {
                data: {
                    titre: 'Promo Été',
                    imageUrl: 'http://storage/ads/pic.jpg',
                    dateDebut: new Date('2026-07-01'),
                    dateFin: new Date('2026-07-31'),
                },
            };

            mockPrismaService.publicite.create.mockResolvedValue({ id: '1', ...expectedPrismaCall.data });

            const result = await service.createAdvertising(inputData);

            expect(mockPrismaService.publicite.create).toHaveBeenCalledWith(expectedPrismaCall);
            expect(result).toHaveProperty('id', '1');
        });

        it('should throw an HttpException if prisma creation fails', async () => {
            mockPrismaService.publicite.create.mockRejectedValue(new Error('Prisma error'));

            await expect(service.createAdvertising({})).rejects.toThrow(
                new HttpException('Impossible de créer la publicité', HttpStatus.BAD_REQUEST),
            );
        });
    });

    describe('getAllAdvertising', () => {
        it('should return an array of ads', async () => {
            const mockAds = [{ id: '1', titre: 'Ad 1' }, { id: '2', titre: 'Ad 2' }];
            mockPrismaService.publicite.findMany.mockResolvedValue(mockAds);

            const result = await service.getAllAdvertising();

            expect(result).toEqual(mockAds);
        });

        it('should return an empty array if prisma fails', async () => {
            mockPrismaService.publicite.findMany.mockRejectedValue(new Error('Prisma error'));

            const result = await service.getAllAdvertising();

            expect(result).toEqual([]);
        });
    });

    describe('deleteAdvertising', () => {
        it('should delete an ad by id', async () => {
            mockPrismaService.publicite.delete.mockResolvedValue({ id: '1', titre: 'Deleted Ad' });

            const result = await service.deleteAdvertising('1');

            expect(mockPrismaService.publicite.delete).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(result).toBeDefined();
        });

        it('should throw an HttpException if deletion fails', async () => {
            mockPrismaService.publicite.delete.mockRejectedValue(new Error('Not found'));

            await expect(service.deleteAdvertising('invalid-id')).rejects.toThrow(
                new HttpException('Impossible de supprimer la publicité', HttpStatus.NOT_FOUND),
            );
        });
    });
});