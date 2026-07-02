import { Test, TestingModule } from '@nestjs/testing';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

describe('RewardsController', () => {
    let controller: RewardsController;
    let service: RewardsService;

    const mockRewardResult = {
        id: 'reward-uuid-777',
        nom: 'Code Promo Carburant',
        pointsRequis: 150,
        description: 'Bénéficiez de 10% de réduction sur votre plein.',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RewardsController],
            providers: [
                {
                    provide: RewardsService,
                    useValue: {
                        createReward: jest.fn(),
                        getAllRewards: jest.fn(),
                        deleteReward: jest.fn(),
                    },
                },
            ],
        })
            // Court-circuit des guards pour isoler le comportement du contrôleur
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .overrideGuard(AdminGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<RewardsController>(RewardsController);
        service = module.get<RewardsService>(RewardsService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('POST /rewards (createReward)', () => {
        it('devrait appeler rewardsService.createReward avec les données fournies', async () => {
            const payload = {
                nom: 'Code Promo Carburant',
                pointsRequis: 150,
                description: 'Bénéficiez de 10% de réduction sur votre plein.',
            };

            // @ts-ignore
            jest.spyOn(service, 'createReward').mockResolvedValue(mockRewardResult);

            const result = await controller.createReward(payload);

            expect(service.createReward).toHaveBeenCalledWith(payload);
            expect(result).toEqual(mockRewardResult);
        });
    });

    describe('GET /rewards (getAllRewards)', () => {
        it('devrait retourner la liste de toutes les récompenses', async () => {
            const mockRewardsList = [mockRewardResult];
            // @ts-ignore
            jest.spyOn(service, 'getAllRewards').mockResolvedValue(mockRewardsList);

            const result = await controller.getAllRewards();

            expect(service.getAllRewards).toHaveBeenCalled();
            expect(result).toEqual(mockRewardsList);
        });
    });

    describe('DELETE /rewards/:id (deleteReward)', () => {
        it('devrait appeler rewardsService.deleteReward avec l\'identifiant ciblé', async () => {
            // @ts-ignore
            jest.spyOn(service, 'deleteReward').mockResolvedValue(mockRewardResult);

            const result = await controller.deleteReward('reward-uuid-777');

            expect(service.deleteReward).toHaveBeenCalledWith('reward-uuid-777');
            expect(result).toEqual(mockRewardResult);
        });
    });
});