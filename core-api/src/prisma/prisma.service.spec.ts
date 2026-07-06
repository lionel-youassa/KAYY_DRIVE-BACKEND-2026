import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
    let service: PrismaService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [PrismaService],
        }).compile();

        service = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('onModuleInit', () => {
        it('should call $connect on initialization', async () => {
            // Espionner et simuler la méthode $connect de PrismaClient
            const connectSpy = jest.spyOn(service, '$connect').mockResolvedValue(undefined);

            await service.onModuleInit();

            expect(connectSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('onModuleDestroy', () => {
        it('should call $disconnect on destruction', async () => {
            // Espionner et simuler la méthode $disconnect de PrismaClient
            const disconnectSpy = jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);

            await service.onModuleDestroy();

            expect(disconnectSpy).toHaveBeenCalledTimes(1);
        });
    });
});