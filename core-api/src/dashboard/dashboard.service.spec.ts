import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    utilisateur: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    positionUtilisateur: {
      count: jest.fn(),
    },
    sessionNavigation: {
      count: jest.fn(),
    },
    itineraire: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    incident: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    raccourciCommunautaire: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    voteRaccourci: {
      count: jest.fn(),
    },
    segmentRoute: {
      findMany: jest.fn(),
    },
    notification: {
      count: jest.fn(),
    },
    tokenFCM: {
      count: jest.fn(),
    },
    adresseFavorite: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOverviewStats', () => {
    it('should return overview stats', async () => {
      mockPrismaService.utilisateur.count.mockResolvedValue(100);
      mockPrismaService.positionUtilisateur.count.mockResolvedValue(50);
      mockPrismaService.sessionNavigation.count.mockResolvedValue(5);
      mockPrismaService.itineraire.findMany.mockResolvedValue([
        { distanceTotale: 1000 },
        { distanceTotale: 2000 },
      ]);
      mockPrismaService.incident.count.mockResolvedValue(2);
      mockPrismaService.raccourciCommunautaire.count.mockResolvedValue(10);

      const result = await service.getOverviewStats();

      expect(result).toEqual({
        totalUsers: 100,
        activeUsers24h: 50,
        activeUsers7d: 50,
        activeUsers30d: 50,
        activeSessions: 5,
        totalDistanceKm: 3,
        incidentsToday: 2,
        totalShortcuts: 10,
        incidentConfirmationRate: 100,
      });
    });
  });

  describe('getShortcutsStats', () => {
    it('should return shortcuts stats', async () => {
      mockPrismaService.raccourciCommunautaire.count.mockResolvedValue(2);
      mockPrismaService.raccourciCommunautaire.findMany.mockResolvedValue([
        { id: '1', nom: 'S1', description: 'D1', scoreFiabilite: 0.8, votesPositifs: 5, votesNegatifs: 1, createur: { pseudo: 'P1' } },
        { id: '2', nom: 'S2', description: 'D2', scoreFiabilite: 0.9, votesPositifs: 10, votesNegatifs: 0, createur: { pseudo: 'P2' } },
      ]);
      mockPrismaService.voteRaccourci.count.mockResolvedValue(15);

      const result = await service.getShortcutsStats();

      expect(result.totalShortcuts).toBe(2);
      expect(result.averageReliabilityScore).toBe(0.85);
      expect(result.adoptionRate).toBe(750);
      expect(result.topShortcuts.length).toBe(2);
    });
  });

  describe('getIncidentsStats', () => {
    it('should return incidents stats', async () => {
      mockPrismaService.incident.groupBy.mockResolvedValue([
        { type: 'INONDATION', _count: { type: 10 } },
        { type: 'TRAFIC', _count: { type: 5 } },
      ]);
      mockPrismaService.incident.count.mockResolvedValue(15);

      const result = await service.getIncidentsStats();

      expect(result.incidentsByType).toEqual([
        { type: 'INONDATION', count: 10, percentage: 66.67 },
        { type: 'TRAFIC', count: 5, percentage: 33.33 },
      ]);
      expect(result.confirmationRate).toBe(100);
      expect(result.incidentsLast7Days.length).toBe(7);
    });
  });

  describe('getSafeDriveStats', () => {
    it('should return safedrive stats', async () => {
      mockPrismaService.segmentRoute.findMany.mockResolvedValue([
        { scoreQualite: 0.8, estOfficiel: true, vitesseMoyenne: 50, estInonde: false },
        { scoreQualite: 0.2, estOfficiel: false, vitesseMoyenne: 20, estInonde: true },
      ]);
      mockPrismaService.itineraire.groupBy.mockResolvedValue([
        { niveauRisque: 'SUR', _count: { niveauRisque: 8 } },
      ]);

      const result = await service.getSafeDriveStats();

      expect(result.averageQualityScore).toBe(0.5);
      expect(result.floodedRoutesCount).toBe(1);
      expect(result.degradedRoutesCount).toBe(1);
      expect(result.averageSpeedByRouteType).toEqual([
        { routeType: 'officiel', averageSpeed: 50, segmentCount: 1 },
        { routeType: 'local', averageSpeed: 20, segmentCount: 1 },
      ]);
    });
  });

  describe('getUserEngagement', () => {
    it('should return user engagement stats', async () => {
      mockPrismaService.utilisateur.findMany.mockResolvedValue([
        { id: 'u1', pseudo: 'User1', email: 'u1@ex.com', scoreReputation: 100, _count: { incidentsSignales: 5, raccourcisCrees: 2, votesRaccourcis: 10 } }
      ]);
      mockPrismaService.utilisateur.count.mockResolvedValue(1);
      mockPrismaService.incident.count.mockResolvedValue(5);
      mockPrismaService.voteRaccourci.count.mockResolvedValue(10);
      mockPrismaService.adresseFavorite.count.mockResolvedValue(2);
      mockPrismaService.adresseFavorite.groupBy.mockResolvedValue([{ utilisateurId: 'u1' }]);

      const result = await service.getUserEngagement();

      expect(result.averageReportsPerUser).toBe(5);
      expect(result.averageVotesPerUser).toBe(10);
      expect(result.totalFavoriteAddresses).toBe(2);
      expect(result.usersWithFavorites).toBe(1);
      expect(result.topContributors[0].pseudo).toBe('User1');
    });
  });

  describe('getSystemPerformance', () => {
    it('should return system performance stats', async () => {
      mockPrismaService.sessionNavigation.count.mockResolvedValue(500);
      mockPrismaService.notification.count.mockResolvedValue(25);
      mockPrismaService.tokenFCM.count.mockResolvedValue(120);

      const result = await service.getSystemPerformance();

      expect(result.totalRouteRequests).toBe(500);
      expect(result.notificationsSent24h).toBe(25);
      expect(result.activeFcmTokens).toBe(120);
    });
  });
});
