import { Test, TestingModule } from '@nestjs/testing';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { GetRouteDto } from './dto/get-route.dto';

describe('NavigationController', () => {
    let controller: NavigationController;
    let service: NavigationService;

    const mockGetRouteDto: GetRouteDto = {
        startLat: 4.045,
        startLng: 9.750,
        endLat: 4.055,
        endLng: 9.760,
    };

    const mockRouteResponse = {
        duration: 600,
        distance: 2500,
        geometry: 'encoded_polyline',
        instructions: [],
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [NavigationController],
            providers: [
                {
                    provide: NavigationService,
                    useValue: {
                        getBasicRoute: jest.fn(),
                        getSmartRoute: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<NavigationController>(NavigationController);
        service = module.get<NavigationService>(NavigationService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /route/basic', () => {
        it('devrait appeler navigationService.getBasicRoute avec le DTO de requête', async () => {
            jest.spyOn(service, 'getBasicRoute').mockResolvedValue(mockRouteResponse);

            const result = await controller.getBasicRoute(mockGetRouteDto);

            expect(service.getBasicRoute).toHaveBeenCalledWith(mockGetRouteDto);
            expect(result).toEqual(mockRouteResponse);
        });
    });

    describe('GET /route/smart', () => {
        it('devrait appeler navigationService.getSmartRoute avec le DTO de requête', async () => {
            jest.spyOn(service, 'getSmartRoute').mockResolvedValue(mockRouteResponse);

            const result = await controller.getSmartRoute(mockGetRouteDto);

            expect(service.getSmartRoute).toHaveBeenCalledWith(mockGetRouteDto);
            expect(result).toEqual(mockRouteResponse);
        });
    });
});