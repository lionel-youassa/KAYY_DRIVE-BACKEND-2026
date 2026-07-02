import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: PrismaService,
          useValue: {
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
          },
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
    it('devrait retourner les statistiques globales (utilisateurs, incidents, raccourcis)', async () => {
      jest.spyOn(prismaService.utilisateur, 'count').mockResolvedValue(150);
      jest.spyOn(prismaService.incident, 'count').mockResolvedValue(45);
      jest.spyOn(prismaService.raccourciCommunautaire, 'count').mockResolvedValue(12);

      const result = await service.getOverviewStats();

      expect(prismaService.utilisateur.count).toHaveBeenCalled();
      expect(prismaService.incident.count).toHaveBeenCalled();
      expect(prismaService.raccourciCommunautaire.count).toHaveBeenCalled();
      expect(result).toEqual({
        totalUsers: 150,
        totalIncidents: 45,
        totalShortcuts: 12,
      });
    });
  });

  describe('getShortcutsStats', () => {
    it('devrait retourner les statistiques des raccourcis communautaires avec le total des votes', async () => {
      jest.spyOn(prismaService.raccourciCommunautaire, 'count').mockResolvedValue(20);
      jest.spyOn(prismaService.voteRaccourci, 'count').mockResolvedValue(140);
      jest.spyOn(prismaService.raccourciCommunautaire, 'findMany').mockResolvedValue([
        { id: 'racc-1', nom: 'Raccourci Douala Nord', idUtilisateurCreateur: 'user-1' }
      ] as any);

      const result = await service.getShortcutsStats();

      expect(prismaService.raccourciCommunautaire.count).toHaveBeenCalled();
      expect(prismaService.voteRaccourci.count).toHaveBeenCalled();
      expect(prismaService.raccourciCommunautaire.findMany).toHaveBeenCalled();
      expect(result).toHaveProperty('totalShortcuts', 20);
      expect(result).toHaveProperty('totalVotes', 140);
      expect(result).toHaveProperty('recentShortcuts');
    });
  });

  describe('getIncidentsStats', () => {
    it('devrait retourner le nombre d incidents groupés par type ou statut', async () => {
      const mockGroupedIncidents = [
        { _count: { id: 25 }, type: 'ACCIDENT' },
        { _count: { id: 10 }, type: 'TRAVAUX' },
      ];
      jest.spyOn(prismaService.incident, 'count').mockResolvedValue(35);
      jest.spyOn(prismaService.incident, 'groupBy').mockResolvedValue(mockGroupedIncidents as any);

      const result = await service.getIncidentsStats();

      expect(prismaService.incident.count).toHaveBeenCalled();
      expect(prismaService.incident.groupBy).toHaveBeenCalled();
      expect(result).toEqual({
        totalIncidents: 35,
        byType: mockGroupedIncidents,
      });
    });
  });

  describe('getSafeDriveStats', () => {
    it('devrait calculer des statistiques sur la sécurité des trajets', async () => {
      jest.spyOn(prismaService.sessionNavigation, 'count').mockResolvedValue(85);
      jest.spyOn(prismaService.segmentRoute, 'findMany').mockResolvedValue([
        { id: 'seg-1', dangerosite: 'haute' }
      ] as any);

      const result = await service.getSafeDriveStats();

      expect(prismaService.sessionNavigation.count).toHaveBeenCalled();
      expect(prismaService.segmentRoute.findMany).toHaveBeenCalled();
      expect(result).toHaveProperty('totalNavigationSessions', 85);
      expect(result).toHaveProperty('monitoredSegments');
    });
  });

  describe('getUserEngagement', () => {
    it('devrait analyser l engagement via les adresses favorites et les positions', async () => {
      jest.spyOn(prismaService.adresseFavorite, 'count').mockResolvedValue(300);
      jest.spyOn(prismaService.positionUtilisateur, 'count').mockResolvedValue(5000);
      jest.spyOn(prismaService.adresseFavorite, 'groupBy').mockResolvedValue([
        { _count: { id: 50 }, categorieId: 'cat-home' }
      ] as any);

      const result = await service.getUserEngagement();

      expect(prismaService.adresseFavorite.count).toHaveBeenCalled();
      expect(prismaService.positionUtilisateur.count).toHaveBeenCalled();
      expect(prismaService.adresseFavorite.groupBy).toHaveBeenCalled();
      expect(result).toEqual({
        totalFavoriteAddresses: 300,
        totalTrackedPositions: 5000,
        popularCategories: [
          { _count: { id: 50 }, categorieId: 'cat-home' }
        ],
      });
    });
  });

  describe('getSystemPerformance', () => {
    it('devrait retourner des métriques systèmes comme les jetons FCM actifs et les notifications envoyées', async () => {
      jest.spyOn(prismaService.notification, 'count').mockResolvedValue(1250);
      jest.spyOn(prismaService.tokenFCM, 'count').mockResolvedValue(420);

      const result = await service.getSystemPerformance();

      expect(prismaService.notification.count).toHaveBeenCalled();
      expect(prismaService.tokenFCM.count).toHaveBeenCalled();
      expect(result).toEqual({
        notificationsSent: 1250,
        activeFCMTokens: 420,
      });
    });
  });
});