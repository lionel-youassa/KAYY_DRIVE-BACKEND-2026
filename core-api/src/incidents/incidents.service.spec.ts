import { Test, TestingModule } from '@nestjs/testing';
import IncidentsService from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prismaService: PrismaService;

  const mockDate = new Date('2026-07-01T12:00:00.000Z');

  const mockIncident = {
    id: 'incident-uuid-111',
    type: 'ACCIDENT',
    description: 'Collision sur l\'axe lourd',
    latitude: 4.0511,
    longitude: 9.7679,
    statut: 'non_confirme',
    scoreFiabilite: 1,
    idRapporteur: 'user-uuid-123',
    dateCreation: mockDate,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: PrismaService,
          useValue: {
            incident: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getIncidentsProches', () => {
    it('devrait retourner la liste des incidents dans un rayon donné', async () => {
      // Simulation du retour de la BDD (généralement filtré par une formule mathématique ou PostGIS)
      jest.spyOn(prismaService.incident, 'findMany').mockResolvedValue([mockIncident] as any);

      const result = await service.getIncidentsProches(4.0510, 9.7670, 5); // lat, lng, rayon en km

      expect(prismaService.incident.findMany).toHaveBeenCalled();
      expect(result).toEqual([mockIncident]);
    });
  });

  describe('createIncident', () => {
    it('devrait créer et retourner un nouvel incident avec succès', async () => {
      const dto = {
        type: 'TRAVAUX',
        description: 'Route barrée pour travaux',
        latitude: 3.8488,
        longitude: 11.5021,
        idRapporteur: 'user-uuid-123',
      };

      const createdIncident = {
        id: 'incident-uuid-222',
        ...dto,
        statut: 'non_confirme',
        scoreFiabilite: 1,
        dateCreation: mockDate,
      };

      jest.spyOn(prismaService.incident, 'create').mockResolvedValue(createdIncident as any);

      // @ts-ignore
      const result = await service.createIncident(dto);

      expect(prismaService.incident.create).toHaveBeenCalledWith({
        data: {
          type: dto.type,
          description: dto.description,
          latitude: dto.latitude,
          longitude: dto.longitude,
          idRapporteur: dto.idRapporteur,
          statut: 'non_confirme',
          scoreFiabilite: 1,
        },
      });
      expect(result).toEqual(createdIncident);
    });
  });

  describe('confirmerIncident', () => {
    it('devrait augmenter le score de fiabilité d\'un incident existant', async () => {
      const updatedIncident = {
        ...mockIncident,
        scoreFiabilite: mockIncident.scoreFiabilite + 1,
        statut: 'confirme',
      };

      jest.spyOn(prismaService.incident, 'findUnique').mockResolvedValue(mockIncident as any);
      jest.spyOn(prismaService.incident, 'update').mockResolvedValue(updatedIncident as any);

      // @ts-ignore
      const result = await service.confirmerIncident('incident-uuid-111');

      expect(prismaService.incident.findUnique).toHaveBeenCalledWith({
        where: { id: 'incident-uuid-111' },
      });
      expect(prismaService.incident.update).toHaveBeenCalledWith({
        where: { id: 'incident-uuid-111' },
        data: {
          scoreFiabilite: { increment: 1 },
          // Optionnel selon ton implémentation : changer le statut si le score est haut
          statut: 'confirme',
        },
      });
      expect(result.scoreFiabilite).toBe(2);
    });

    it('devrait lever une exception NotFoundException si l\'incident à confirmer n\'existe pas', async () => {
      jest.spyOn(prismaService.incident, 'findUnique').mockResolvedValue(null);

      // @ts-ignore
      await expect(service.confirmerIncident('id-inconnu')).rejects.toThrow(NotFoundException);
      expect(prismaService.incident.update).not.toHaveBeenCalled();
    });
  });
});