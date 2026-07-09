import { Test, TestingModule } from '@nestjs/testing';
import { RoutesService } from './routes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('RoutesService', () => {
  let service: RoutesService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    raccourciCommunautaire: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    voteRaccourci: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<RoutesService>(RoutesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRaccourci', () => {
    it('should create and return shortcut suggestion', async () => {
      const input = {
        nom: 'Raccourci Test',
        description: 'Test description',
        pointDepart: { latitude: 4.0511, longitude: 9.7679 },
        pointArrivee: { latitude: 4.0530, longitude: 9.7690 },
        trace: [{ latitude: 4.0511, longitude: 9.7679 }],
        id_utilisateur_createur: 'user-uuid',
      };

      const dbOutput = {
        id: 'shortcut-123',
        nom: input.nom,
        description: input.description,
        pointDepartLat: input.pointDepart.latitude,
        pointDepartLng: input.pointDepart.longitude,
        pointArriveeLat: input.pointArrivee.latitude,
        pointArriveeLng: input.pointArrivee.longitude,
        trace: input.trace,
        idUtilisateurCreateur: input.id_utilisateur_createur,
        votesPositifs: 0,
        votesNegatifs: 0,
        scoreFiabilite: 0,
        statut: 'propose',
        dateCreation: new Date('2026-07-09T10:00:00Z'),
      };

      mockPrismaService.raccourciCommunautaire.create.mockResolvedValue(dbOutput);

      const result = await service.createRaccourci(input);

      expect(prismaService.raccourciCommunautaire.create).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'shortcut-123',
        nom: 'Raccourci Test',
        description: 'Test description',
        pointDepart: input.pointDepart,
        pointArrivee: input.pointArrivee,
        trace: input.trace,
        id_utilisateur_createur: 'user-uuid',
        votesPositifs: 0,
        votesNegatifs: 0,
        votants: {},
        scoreFiabilite: 0,
        statut: 'propose',
        dateCreation: dbOutput.dateCreation.toISOString(),
      });
    });
  });

  describe('voterRaccourci', () => {
    const shortcutId = 'shortcut-123';
    const userId = 'user-uuid';
    const dbShortcut = {
      id: shortcutId,
      nom: 'Test',
      description: 'Desc',
      pointDepartLat: 4.0,
      pointDepartLng: 9.0,
      pointArriveeLat: 4.1,
      pointArriveeLng: 9.1,
      trace: [],
      idUtilisateurCreateur: 'creator-uuid',
      votesPositifs: 2,
      votesNegatifs: 1,
      scoreFiabilite: 0.66,
      statut: 'propose',
      dateCreation: new Date('2026-07-09T10:00:00Z'),
      votes: [],
    };

    it('should throw NotFoundException if shortcut is not found', async () => {
      mockPrismaService.raccourciCommunautaire.findUnique.mockResolvedValue(null);
      await expect(service.voterRaccourci(shortcutId, userId, 'positif')).rejects.toThrow(NotFoundException);
    });

    it('should record a positive vote and update reliability score', async () => {
      mockPrismaService.raccourciCommunautaire.findUnique.mockResolvedValue(dbShortcut);
      mockPrismaService.voteRaccourci.upsert.mockResolvedValue({});
      mockPrismaService.raccourciCommunautaire.update.mockResolvedValue({
        ...dbShortcut,
        votesPositifs: 3,
        scoreFiabilite: 0.75,
      });

      const result = await service.voterRaccourci(shortcutId, userId, 'positif');

      expect(prismaService.voteRaccourci.upsert).toHaveBeenCalled();
      expect(prismaService.raccourciCommunautaire.update).toHaveBeenCalledWith({
        where: { id: shortcutId },
        data: {
          votesPositifs: 3,
          votesNegatifs: 1,
          scoreFiabilite: 0.75,
          statut: 'propose',
        },
      });
      expect(result.message).toBe('Vote enregistré');
      expect(result.raccourci.votesPositifs).toBe(3);
    });

    it('should promote shortcut to valide if votes threshold and score are reached', async () => {
      const shortcutNearThreshold = {
        ...dbShortcut,
        votesPositifs: 4,
        votesNegatifs: 0,
      };
      mockPrismaService.raccourciCommunautaire.findUnique.mockResolvedValue(shortcutNearThreshold);
      mockPrismaService.raccourciCommunautaire.update.mockResolvedValue({
        ...shortcutNearThreshold,
        votesPositifs: 5,
        scoreFiabilite: 1.0,
        statut: 'valide',
      });

      const result = await service.voterRaccourci(shortcutId, userId, 'positif');

      expect(prismaService.raccourciCommunautaire.update).toHaveBeenCalledWith({
        where: { id: shortcutId },
        data: {
          votesPositifs: 5,
          votesNegatifs: 0,
          scoreFiabilite: 1.0,
          statut: 'valide',
        },
      });
      expect(result.raccourci.statut).toBe('valide');
    });
  });

  describe('suggererRaccourcis', () => {
    const listShortcuts = [
      {
        id: 's1',
        nom: 'Shortcut 1',
        description: 'D1',
        pointDepartLat: 4.0511,
        pointDepartLng: 9.7679,
        pointArriveeLat: 4.0520,
        pointArriveeLng: 9.7689,
        trace: [],
        idUtilisateurCreateur: 'u1',
        votesPositifs: 5,
        votesNegatifs: 0,
        scoreFiabilite: 1.0,
        statut: 'valide',
        dateCreation: new Date(),
      },
      {
        id: 's2',
        nom: 'Shortcut 2',
        description: 'D2',
        pointDepartLat: 4.2500, // far away
        pointDepartLng: 9.7679,
        pointArriveeLat: 4.2520,
        pointArriveeLng: 9.7689,
        trace: [],
        idUtilisateurCreateur: 'u2',
        votesPositifs: 5,
        votesNegatifs: 0,
        scoreFiabilite: 1.0,
        statut: 'valide',
        dateCreation: new Date(),
      },
    ];

    it('should filter suggestions within radius', async () => {
      mockPrismaService.raccourciCommunautaire.findMany.mockResolvedValue(listShortcuts);

      // Search with start=4.0511, 9.7679 and end=4.0520, 9.7689
      const result = await service.suggererRaccourcis(
        { latitude: 4.0511, longitude: 9.7679 },
        { latitude: 4.0520, longitude: 9.7689 },
        1000,
      );

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('s1');
    });
  });
});
