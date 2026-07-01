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

  // TODO: Add tests for:
  // - getOverviewStats
  // - getShortcutsStats
  // - getIncidentsStats
  // - getSafeDriveStats
  // - getUserEngagement
  // - getSystemPerformance
});
