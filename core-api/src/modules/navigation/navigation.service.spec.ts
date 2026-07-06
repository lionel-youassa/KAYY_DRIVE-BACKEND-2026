import { Test, TestingModule } from '@nestjs/testing';
import { NavigationService } from './navigation.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { NavigationParserService } from './navigation-parser.service';
import { RoutesService } from '../../routes/routes.service';
import { TraficService } from '../../trafic/trafic.service';
import { PrismaService } from '../../prisma/prisma.service';
import { of } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('NavigationService', () => {
    let service: NavigationService;
    let httpService: HttpService;

    const mockHttpService = {
        get: jest.fn(),
        post: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn((key, fallback) => fallback),
    };

    const mockParserService = {
        parseInstructions: jest.fn().mockReturnValue([]),
    };

    const mockRoutesService = {
        suggererRaccourcis: jest.fn().mockResolvedValue([]),
    };

    const mockTraficService = {
        getTraficActuel: jest.fn().mockResolvedValue({ niveau: 'fluide', vitesseMoyenne: 50 }),
    };

    const mockPrismaService = {
        incident: { findMany: jest.fn().mockResolvedValue([]) },
        secousseData: { findMany: jest.fn().mockResolvedValue([]) },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                NavigationService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: NavigationParserService, useValue: mockParserService },
                { provide: RoutesService, useValue: mockRoutesService },
                { provide: TraficService, useValue: mockTraficService },
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<NavigationService>(NavigationService);
        httpService = module.get<HttpService>(HttpService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('snapToRoad', () => {
        it('should return snapped coordinates on OSRM success', async () => {
            const mockResponse = {
                data: {
                    code: 'Ok',
                    matchings: [{ geometry: { coordinates: [[11.5, 3.8]] }, confidence: 0.9, distance: 10, duration: 2 }],
                },
            };
            mockHttpService.get.mockReturnValue(of(mockResponse));

            const result = await service.snapToRoad([[11.5, 3.8]]);
            expect(result).toHaveProperty('snappedCoordinates');
        });

        it('should return null if OSRM fails', async () => {
            mockHttpService.get.mockReturnValue(of({ data: { code: 'Error' } }));
            const result = await service.snapToRoad([[11.5, 3.8]]);
            expect(result).toBeNull();
        });
    });

    describe('getBasicRoute', () => {
        it('should throw an error if coordinates are invalid', async () => {
            const invalidQuery = { startLat: NaN, startLng: 11.5, endLat: 3.9, endLng: 11.6, mode: 'driving' };
            await expect(service.getBasicRoute(invalidQuery as any)).rejects.toThrow(HttpException);
        });
    });
});