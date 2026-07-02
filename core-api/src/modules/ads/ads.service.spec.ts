import { Test, TestingModule } from '@nestjs/testing';
import { AdsService } from './ads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AdsService', () => {
    let service: AdsService;
    let prisma: PrismaService;

    // Mock de PrismaClient pour l'entité publicite
    const mockPrisma = {
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
                    useValue: mockPrisma,
                },
            ],
        }).compile();

        service = module.get<AdsService>(AdsService);
        prisma = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createAdvertising', () => {
        it('devrait exclure mediaPath et enregistrer la publicité avec succès', async () => {
            const inputData = {
                titre: 'Promo KayyDrive',
                type: 'pop-up',
                mediaPath: '/cache/local/file.png', // Doit être extrait
                dateDebut: new Date(),
            };

            const expectedPrismaData = {
                titre: 'Promo KayyDrive',
                type: 'pop-up',
                dateDebut: inputData.dateDebut,
            };

            mockPrisma.publicite.create.mockResolvedValue({ id: 'ad-1', ...expectedPrismaData });

            const result = await service.createAdvertising(inputData);

            expect(prisma.publicite.create).toHaveBeenCalledWith({
                data: expectedPrismaData,
            });
            expect(result).toHaveProperty('id', 'ad-1');
        });

        it('devrait lever une HttpException de type BAD_REQUEST en cas d\'échec de création Prisma', async () => {
            mockPrisma.publicite.create.mockRejectedValue(new Error('Prisma Error'));

            await expect(service.createAdvertising({})).rejects.toThrow(
                new HttpException('Impossible de créer la publicité', HttpStatus.BAD_REQUEST),
            );
        });
    });

    describe('getAllAdvertising', () => {
        it('devrait renvoyer la liste complète des publicités', async () => {
            const mockAds = [{ id: '1', titre: 'Ad 1' }, { id: '2', titre: 'Ad 2' }];
            mockPrisma.publicite.findMany.mockResolvedValue(mockAds);

            const result = await service.getAllAdvertising();

            expect(prisma.publicite.findMany).toHaveBeenCalled();
            expect(result).toEqual(mockAds);
        });

        it('devrait retourner un tableau vide si findMany lève une exception (évite de faire planter Flutter)', async () => {
            mockPrisma.publicite.findMany.mockRejectedValue(new Error('Database Down'));

            const result = await service.getAllAdvertising();

            expect(result).toEqual([]);
        });
    });

    describe('deleteAdvertising', () => {
        it('devrait appeler prisma.publicite.delete avec le bon ID', async () => {
            const mockDeletedAd = { id: 'ad-to-delete', titre: 'Ad Expiré' };
            mockPrisma.publicite.delete.mockResolvedValue(mockDeletedAd);

            const result = await service.deleteAdvertising('ad-to-delete');

            expect(prisma.publicite.delete).toHaveBeenCalledWith({
                where: { id: 'ad-to-delete' },
            });
            expect(result).toEqual(mockDeletedAd);
        });

        it('devrait lever une HttpException de type NOT_FOUND si l\'ID n\'existe pas dans la base', async () => {
            mockPrisma.publicite.delete.mockRejectedValue(new Error('Record not found'));

            await expect(service.deleteAdvertising('id-inconnu')).rejects.toThrow(
                new HttpException('Impossible de supprimer la publicité', HttpStatus.NOT_FOUND),
            );
        });
    });
});