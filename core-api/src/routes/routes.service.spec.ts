import { Test, TestingModule } from '@nestjs/testing';
import { RoutesService } from './routes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('RoutesService', () => {
  let service: RoutesService;
  let prismaService: PrismaService;

  const mockDate = new Date('2026-07-01T12:00:00.000Z');

  const mockRaccourci = {
    id: 'raccourci-uuid-123',
    nom: 'Raccourci Évitement Bouchon Axe Lourd',
    description: 'Passe par les quartiers intérieurs pour éviter le carrefour',
    pointDepartLat: 4.0511,
    pointDepartLng: 9.7679,
    pointArriveeLat: 4.0600,
    pointArriveeLng: 9.7750,
    trace: { type: 'LineString', coordinates: [[9.7679, 4.0511], [9.7750, 4.0600]] },
    idUtilisateurCreateur: 'user-uuid-999',
    scoreFiabilite: 1,
    dateCreation: mockDate,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        {
          provide: PrismaService,
          useValue: {
            raccourciCommunautaire: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            voteRaccourci: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
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
    it('devrait enregistrer un nouveau raccourci avec succès', async () => {
      const dto = {
        nom: 'Piste Omnisports',
        description: 'Évite le feu rouge principal',
        pointDepartLat: 3.8488,
        pointDepartLng: 11.5021,
        pointArriveeLat: 3.8550,
        pointArriveeLng: 11.5100,
        trace: { type: 'LineString', coordinates: [[11.5021, 3.8488], [11.5100, 3.8550]] },
        idUtilisateurCreateur: 'user-uuid-999',
      };

      const createdRaccourci = {
        id: 'raccourci-uuid-456',
        ...dto,
        scoreFiabilite: 1,
        dateCreation: mockDate,
      };

      jest.spyOn(prismaService.raccourciCommunautaire, 'create').mockResolvedValue(createdRaccourci as any);

      // @ts-ignore
      const result = await service.createRaccourci(dto);

      expect(prismaService.raccourciCommunautaire.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          scoreFiabilite: 1,
        },
      });
      expect(result).toEqual(createdRaccourci);
    });
  });

  describe('voterRaccourci', () => {
    it('devrait enregistrer le vote et mettre à jour le score du raccourci (Vote Positif)', async () => {
      const voteDto = {
        idRaccourci: 'raccourci-uuid-123',
        idUtilisateur: 'user-uuid-888',
        valeur: 1, // 1 pour upvote, -1 pour downvote
      };

      jest.spyOn(prismaService.raccourciCommunautaire, 'findUnique').mockResolvedValue(mockRaccourci as any);
      jest.spyOn(prismaService.voteRaccourci, 'findUnique').mockResolvedValue(null); // L'utilisateur n'a pas encore voté
      jest.spyOn(prismaService.voteRaccourci, 'create').mockResolvedValue({ id: 'vote-id-1', ...voteDto } as any);
      jest.spyOn(prismaService.raccourciCommunautaire, 'update').mockResolvedValue({
        ...mockRaccourci,
        scoreFiabilite: mockRaccourci.scoreFiabilite + 1,
      } as any);

      // @ts-ignore
      const result = await service.voterRaccourci(voteDto.idRaccourci, voteDto.idUtilisateur, voteDto.valeur);

      expect(prismaService.raccourciCommunautaire.findUnique).toHaveBeenCalledWith({
        where: { id: voteDto.idRaccourci },
      });
      expect(prismaService.voteRaccourci.create).toHaveBeenCalled();
      expect(prismaService.raccourciCommunautaire.update).toHaveBeenCalledWith({
        where: { id: voteDto.idRaccourci },
        data: {
          scoreFiabilite: { increment: voteDto.valeur },
        },
      });
      expect(result.scoreFiabilite).toBe(2);
    });

    it('devrait lever une exception NotFoundException si le raccourci n\'existe pas', async () => {
      jest.spyOn(prismaService.raccourciCommunautaire, 'findUnique').mockResolvedValue(null);

      // @ts-ignore
      await expect(service.voterRaccourci('id-invalide', 'user-1', 1)).rejects.toThrow(NotFoundException);
      expect(prismaService.voteRaccourci.create).not.toHaveBeenCalled();
    });
  });

  describe('suggererRaccourcis', () => {
    it('devrait retourner la liste des raccourcis à proximité d\'un itinéraire donné', async () => {
      jest.spyOn(prismaService.raccourciCommunautaire, 'findMany').mockResolvedValue([mockRaccourci] as any);

      // Simulation de la recherche de suggestions de déviation/raccourcis pour des coordonnées de départ/arrivée
      // @ts-ignore
      const result = await service.suggererRaccourcis(4.0500, 9.7600, 4.0650, 9.7800);

      expect(prismaService.raccourciCommunautaire.findMany).toHaveBeenCalled();
      expect(result).toEqual([mockRaccourci]);
    });
  });
});