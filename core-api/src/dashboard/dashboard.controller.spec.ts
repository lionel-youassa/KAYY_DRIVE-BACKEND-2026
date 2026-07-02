import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

describe('DashboardController', () => {
    let controller: DashboardController;
    let service: DashboardService;

    // Mocks des réponses du service
    const mockOverviewStats = { totalUsers: 150, totalIncidents: 45, totalShortcuts: 12 };
    const mockShortcutsStats = { totalShortcuts: 20, totalVotes: 140, recentShortcuts: [] };
    const mockIncidentsStats = { totalIncidents: 35, byType: [] };
    const mockSafeDriveStats = { totalNavigationSessions: 85, monitoredSegments: [] };
    const mockUserEngagement = { totalFavoriteAddresses: 300, totalTrackedPositions: 5000 };
    const mockSystemPerformance = { notificationsSent: 1250, activeFCMTokens: 420 };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DashboardController],
            providers: [
                {
                    provide: DashboardService,
                    useValue: {
                        getOverviewStats: jest.fn().mockResolvedValue(mockOverviewStats),
                        getShortcutsStats: jest.fn().mockResolvedValue(mockShortcutsStats),
                        getIncidentsStats: jest.fn().mockResolvedValue(mockIncidentsStats),
                        getSafeDriveStats: jest.fn().mockResolvedValue(mockSafeDriveStats),
                        getUserEngagement: jest.fn().mockResolvedValue(mockUserEngagement),
                        getSystemPerformance: jest.fn().mockResolvedValue(mockSystemPerformance),
                    },
                },
            ],
        })
            // Désactivation des guards pour tester purement la logique du contrôleur
            .overrideGuard(AuthGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .overrideGuard(AdminGuard)
            .useValue({ canActivate: jest.fn(() => true) })
            .compile();

        controller = module.get<DashboardController>(DashboardController);
        service = module.get<DashboardService>(DashboardService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /dashboard/overview', () => {
        it('devrait retourner les statistiques générales du système', async () => {
            const result = await controller.getOverview();
            expect(service.getOverviewStats).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockOverviewStats);
        });
    });

    describe('GET /dashboard/shortcuts', () => {
        it('devrait retourner les statistiques des raccourcis communautaires', async () => {
            const result = await controller.getShortcuts();
            expect(service.getShortcutsStats).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockShortcutsStats);
        });
    });

    describe('GET /dashboard/incidents', () => {
        it('devrait retourner les statistiques des incidents', async () => {
            const result = await controller.getIncidents();
            expect(service.getIncidentsStats).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockIncidentsStats);
        });
    });

    describe('GET /dashboard/safedrive', () => {
        it('devrait retourner les statistiques SafeDrive', async () => {
            const result = await controller.getSafeDrive();
            expect(service.getSafeDriveStats).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockSafeDriveStats);
        });
    });

    describe('GET /dashboard/engagement', () => {
        it('devrait retourner les statistiques d engagement utilisateur', async () => {
            const result = await controller.getEngagement();
            expect(service.getUserEngagement).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockUserEngagement);
        });
    });

    describe('GET /dashboard/performance', () => {
        it('devrait retourner les statistiques de performance système', async () => {
            const result = await controller.getPerformance();
            expect(service.getSystemPerformance).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockSystemPerformance);
        });
    });

    describe('GET /dashboard/all', () => {
        it('devrait agréger et retourner toutes les statistiques du dashboard en parallèle', async () => {
            const result = await controller.getAll();

            expect(service.getOverviewStats).toHaveBeenCalledTimes(1);
            expect(service.getShortcutsStats).toHaveBeenCalledTimes(1);
            expect(service.getIncidentsStats).toHaveBeenCalledTimes(1);
            expect(service.getSafeDriveStats).toHaveBeenCalledTimes(1);
            expect(service.getUserEngagement).toHaveBeenCalledTimes(1);
            expect(service.getSystemPerformance).toHaveBeenCalledTimes(1);

            expect(result).toEqual({
                overview: mockOverviewStats,
                shortcuts: mockShortcutsStats,
                incidents: mockIncidentsStats,
                safeDrive: mockSafeDriveStats,
                engagement: mockUserEngagement,
                performance: mockSystemPerformance,
            });
        });
    });
});