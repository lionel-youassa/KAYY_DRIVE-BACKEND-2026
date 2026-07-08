import { Test, TestingModule } from '@nestjs/testing';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('IncidentsService', () => {
  let service: IncidentsService;
  let prismaService: PrismaService;
  let geocodingService: GeocodingService;

  const mockPrismaService = {
    incident: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGeocodingService = {
    reverse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IncidentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GeocodingService,
          useValue: mockGeocodingService,
        },
      ],
    }).compile();

    service = module.get<IncidentsService>(IncidentsService);
    prismaService = module.get<PrismaService>(PrismaService);
    geocodingService = module.get<GeocodingService>(GeocodingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createIncident', () => {
    const createData = {
      type: 'inondation' as const,
      description: 'Grave inondation',
      latitude: 4.0511,
      longitude: 9.7679,
      id_utilisateur_createur: 'creator-uuid',
      imageUrl: 'http://image.jpg',
    };

    it('should create an incident successfully', async () => {
      mockGeocodingService.reverse.mockResolvedValue({
        quartier: 'Akwa',
        ville: 'Douala',
        region: 'Littoral',
      });

      const dbIncident = {
        id: 'inc-uuid',
        type: 'INONDATION',
        description: createData.description,
        horodatage: new Date('2026-07-08T12:00:00Z'),
        nombreConfirmations: 1,
        statut: 'non_confirme',
        idRapporteur: createData.id_utilisateur_createur,
        dateExpiration: new Date('2026-07-08T18:00:00Z'),
        confirmePar: [createData.id_utilisateur_createur],
        latitude: createData.latitude,
        longitude: createData.longitude,
        imageUrl: createData.imageUrl,
        quartier: 'Akwa',
        ville: 'Douala',
        region: 'Littoral',
      };

      mockPrismaService.incident.create.mockResolvedValue(dbIncident);

      const result = await service.createIncident(createData);

      expect(geocodingService.reverse).toHaveBeenCalledWith(createData.latitude, createData.longitude);
      expect(prismaService.incident.create).toHaveBeenCalled();
      expect(result).toEqual({
        id: 'inc-uuid',
        type: 'inondation',
        description: 'Grave inondation',
        latitude: 4.0511,
        longitude: 9.7679,
        id_utilisateur_createur: 'creator-uuid',
        statut: 'non_confirme',
        nombreConfirmations: 1,
        confirmePar: ['creator-uuid'],
        dateCreation: dbIncident.horodatage.toISOString(),
        dateExpiration: dbIncident.dateExpiration.toISOString(),
        imageUrl: 'http://image.jpg',
      });
    });
  });

  describe('confirmerIncident', () => {
    const incidentId = 'inc-uuid';
    const userId = 'user-uuid';
    const dbIncident = {
      id: incidentId,
      type: 'INONDATION',
      description: 'Inondation Akwa',
      horodatage: new Date('2026-07-08T12:00:00Z'),
      nombreConfirmations: 1,
      statut: 'non_confirme',
      idRapporteur: 'creator-uuid',
      dateExpiration: new Date('2026-07-08T20:00:00Z'),
      confirmePar: ['creator-uuid'],
      latitude: 4.0511,
      longitude: 9.7679,
    };

    it('should confirm incident and return updated state', async () => {
      mockPrismaService.incident.findUnique.mockResolvedValue(dbIncident);
      mockPrismaService.incident.update.mockResolvedValue({
        ...dbIncident,
        confirmePar: ['creator-uuid', userId],
        nombreConfirmations: 2,
      });

      const result = await service.confirmerIncident(incidentId, userId, 4.0511, 9.7679);

      expect(prismaService.incident.findUnique).toHaveBeenCalledWith({ where: { id: incidentId } });
      expect(prismaService.incident.update).toHaveBeenCalledWith({
        where: { id: incidentId },
        data: {
          confirmePar: ['creator-uuid', userId],
          nombreConfirmations: 2,
          statut: 'non_confirme',
        },
      });
      expect(result.message).toBe('Confirmation enregistrée');
      expect(result.incident.nombreConfirmations).toBe(2);
    });

    it('should promote to confirme when threshold is reached', async () => {
      const dbIncidentNearLimit = {
        ...dbIncident,
        confirmePar: ['c1', 'c2'],
        nombreConfirmations: 2,
      };
      mockPrismaService.incident.findUnique.mockResolvedValue(dbIncidentNearLimit);
      mockPrismaService.incident.update.mockResolvedValue({
        ...dbIncidentNearLimit,
        confirmePar: ['c1', 'c2', userId],
        nombreConfirmations: 3,
        statut: 'confirme',
      });

      const result = await service.confirmerIncident(incidentId, userId, 4.0511, 9.7679);

      expect(prismaService.incident.update).toHaveBeenCalledWith({
        where: { id: incidentId },
        data: {
          confirmePar: ['c1', 'c2', userId],
          nombreConfirmations: 3,
          statut: 'confirme',
        },
      });
      expect(result.message).toBe('Incident confirmé par la communauté !');
      expect(result.incident.statut).toBe('confirme');
    });

    it('should throw NotFoundException if incident does not exist', async () => {
      mockPrismaService.incident.findUnique.mockResolvedValue(null);
      await expect(service.confirmerIncident(incidentId, userId, 4.0, 9.0)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if incident has expired', async () => {
      const expiredIncident = {
        ...dbIncident,
        dateExpiration: new Date('2026-07-08T10:00:00Z'), // past
      };
      mockPrismaService.incident.findUnique.mockResolvedValue(expiredIncident);
      await expect(service.confirmerIncident(incidentId, userId, 4.0, 9.0)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user already confirmed', async () => {
      const alreadyConfirmed = {
        ...dbIncident,
        confirmePar: ['creator-uuid', userId],
      };
      mockPrismaService.incident.findUnique.mockResolvedValue(alreadyConfirmed);
      await expect(service.confirmerIncident(incidentId, userId, 4.0, 9.0)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getIncidentsProches', () => {
    const listIncidents = [
      {
        id: 'inc-1',
        type: 'INONDATION',
        latitude: 4.0511,
        longitude: 9.7679,
        horodatage: new Date(),
        dateExpiration: new Date(Date.now() + 100000),
        idRapporteur: 'creator-1',
        confirmePar: ['creator-1'],
        nombreConfirmations: 1,
        quartier: 'Akwa',
        ville: 'Douala',
        region: 'Littoral',
      },
      {
        id: 'inc-2',
        type: 'QUALITE_ROUTE',
        latitude: 4.1500, // further away (~11 km)
        longitude: 9.7679,
        horodatage: new Date(),
        dateExpiration: new Date(Date.now() + 100000),
        idRapporteur: 'creator-2',
        confirmePar: ['creator-2'],
        nombreConfirmations: 1,
        quartier: 'Bonamoussadi',
        ville: 'Douala',
        region: 'Littoral',
      },
    ];

    it('should filter incidents by geographical distance (default)', async () => {
      mockPrismaService.incident.findMany.mockResolvedValue(listIncidents);

      // Search at 4.0511, 9.7679 with radius 5km (inc-2 is 11km away, should be filtered out)
      const result = await service.getIncidentsProches(4.0511, 9.7679, 5000);

      expect(result.length).toBe(1);
      expect(result[0].id).toBe('inc-1');
    });

    it('should filter incidents by ville when filterType is ville', async () => {
      mockPrismaService.incident.findMany.mockResolvedValue(listIncidents);
      mockGeocodingService.reverse.mockResolvedValue({
        quartier: 'Akwa',
        ville: 'Douala',
        region: 'Littoral',
      });

      const result = await service.getIncidentsProches(4.0511, 9.7679, 5000, 'ville');

      // Both are in 'Douala'
      expect(result.length).toBe(2);
    });
  });

  describe('resoudreIncident', () => {
    it('should update status to resolu', async () => {
      mockPrismaService.incident.update.mockResolvedValue({});
      await service.resoudreIncident('inc-uuid');
      expect(prismaService.incident.update).toHaveBeenCalledWith({
        where: { id: 'inc-uuid' },
        data: { statut: 'resolu' },
      });
    });
  });
});
