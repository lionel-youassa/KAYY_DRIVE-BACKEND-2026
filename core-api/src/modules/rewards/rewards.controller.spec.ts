import { Test, TestingModule } from '@nestjs/testing';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { StorageService } from '../../storage/storage.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

describe('RewardsController', () => {
    let controller: RewardsController;
    let rewardsService: RewardsService;
    let storageService: StorageService;

    const mockRewardsService = {
        createReward: jest.fn(),
        getAllRewards: jest.fn(),
        deleteReward: jest.fn(),
    };

    const mockStorageService = {
        uploadFile: jest.fn(),
    };

    const mockGuard = { canActivate: () => true };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RewardsController],
            providers: [
                { provide: RewardsService, useValue: mockRewardsService },
                { provide: StorageService, useValue: mockStorageService },
            ],
        })
            .overrideGuard(AuthGuard)
            .useValue(mockGuard)
            .overrideGuard(AdminGuard)
            .useValue(mockGuard)
            .compile();

        controller = module.get<RewardsController>(RewardsController);
        rewardsService = module.get<RewardsService>(RewardsService);
        storageService = module.get<StorageService>(StorageService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createReward', () => {
        it('should upload image and create a reward', async () => {
            const mockBody = { titre: 'Récompense Or', points: '100' };
            const mockFile = { originalname: 'gold.png' } as Express.Multer.File;
            const mockImageUrl = 'http://storage/rewards/gold.png';
            const mockCreatedReward = { id: 'r10', ...mockBody, imageUrl: mockImageUrl };

            mockStorageService.uploadFile.mockResolvedValue(mockImageUrl);
            mockRewardsService.createReward.mockResolvedValue(mockCreatedReward);

            const result = await controller.createReward(mockBody, mockFile);

            expect(storageService.uploadFile).toHaveBeenCalledWith(mockFile, 'rewards');
            expect(rewardsService.createReward).toHaveBeenCalledWith({
                ...mockBody,
                imageUrl: mockImageUrl,
            });
            expect(result).toEqual({
                success: true,
                message: 'Récompense créée avec succès',
                reward: mockCreatedReward,
            });
        });

        it('should create a reward without an image if none is provided', async () => {
            const mockBody = { titre: 'Pas de visuel' };
            const mockCreatedReward = { id: 'r11', ...mockBody, imageUrl: undefined };

            mockRewardsService.createReward.mockResolvedValue(mockCreatedReward);

            const result = await controller.createReward(mockBody, undefined);

            expect(storageService.uploadFile).not.toHaveBeenCalled();
            expect(rewardsService.createReward).toHaveBeenCalledWith({
                ...mockBody,
                imageUrl: undefined,
            });
            expect(result.reward).toEqual(mockCreatedReward);
        });
    });

    describe('getAllRewards', () => {
        it('should return all rewards from service', async () => {
            const mockRewards = [{ id: '1', points: 10 }];
            mockRewardsService.getAllRewards.mockResolvedValue(mockRewards);

            const result = await controller.getAllRewards();

            expect(rewardsService.getAllRewards).toHaveBeenCalled();
            expect(result).toEqual(mockRewards);
        });
    });

    describe('deleteReward', () => {
        it('should delete reward and return a success message', async () => {
            mockRewardsService.deleteReward.mockResolvedValue({ id: 'id-deleted' });

            const result = await controller.deleteReward('id-deleted');

            expect(rewardsService.deleteReward).toHaveBeenCalledWith('id-deleted');
            expect(result).toEqual({ success: true, message: 'Récompense supprimée' });
        });
    });
});