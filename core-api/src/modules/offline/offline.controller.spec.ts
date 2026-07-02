import { Test, TestingModule } from '@nestjs/testing';
import { OfflineController } from './offline.controller';
import { OfflineService, OfflineZone, ZoneMetadata } from './offline.service';

describe('OfflineController', () => {
    let controller: OfflineController;
    let service: OfflineService;

    const mockZone: OfflineZone = {
        id: 'douala-centre',
        name: 'Douala Centre',
        bounds: { north: 4.1, south: 4.0, east: 9.8, west: 9.7 },
        size: 25000000,
        lastUpdated: '2026-03-01T12:00:00.000Z',
        status: 'available',
    };

    const mockMetadata: ZoneMetadata = {
        id: 'douala-centre',
        name: 'Douala Centre',
        description: 'Région métropolitaine de Douala',
        bounds: { north: 4.1, south: 4.0, east: 9.8, west: 9.7 },
        minZoom: 12,
        maxZoom: 16,
        format: 'pbf',
        size: 25000000,
        tileCount: 3500,
        lastGenerated: '2026-03-01T12:00:00.000Z',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [OfflineController],
            providers: [
                {
                    provide: OfflineService,
                    useValue: {
                        getAvailableZones: jest.fn(),
                        getZoneMetadata: jest.fn(),
                        downloadZone: jest.fn(),
                        generateZone: jest.fn(),
                    },
                },
            ],
        }).compile();

        controller = module.get<OfflineController>(OfflineController);
        service = module.get<OfflineService>(OfflineService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('GET /offline/zones (getAvailableZones)', () => {
        it('devrait retourner la liste des zones disponibles', async () => {
            const mockZonesList = [mockZone];
            jest.spyOn(service, 'getAvailableZones').mockResolvedValue(mockZonesList);

            const result = await controller.getAvailableZones();

            expect(service.getAvailableZones).toHaveBeenCalled();
            expect(result).toEqual(mockZonesList);
        });
    });

    describe('GET /offline/zones/:zoneId/metadata (getZoneMetadata)', () => {
        it('devrait retourner les métadonnées de la zone demandée', async () => {
            jest.spyOn(service, 'getZoneMetadata').mockResolvedValue(mockMetadata);

            const result = await controller.getZoneMetadata('douala-centre');

            expect(service.getZoneMetadata).toHaveBeenCalledWith('douala-centre');
            expect(result).toEqual(mockMetadata);
        });
    });

    describe('GET /offline/zones/:zoneId/download (downloadZone)', () => {
        it('devrait renvoyer les informations de téléchargement de fichier pour la zone', async () => {
            const mockDownloadResponse = {
                filename: 'douala-centre.mbtiles',
                path: '/mock/path/douala-centre.mbtiles',
                size: 25000000,
            };
            jest.spyOn(service, 'downloadZone').mockResolvedValue(mockDownloadResponse as any);

            const result = await controller.downloadZone('douala-centre');

            expect(service.downloadZone).toHaveBeenCalledWith('douala-centre');
            expect(result).toEqual(mockDownloadResponse);
        });
    });

    describe('POST /offline/zones/:zoneId/generate (generateZone)', () => {
        it('devrait initier la génération MBTiles pour la zone spécifiée', async () => {
            const mockGenResponse = {
                success: true,
                message: 'Zone douala-centre générée avec succès',
                zoneId: 'douala-centre',
                size: 50000000,
            };
            jest.spyOn(service, 'generateZone').mockResolvedValue(mockGenResponse);

            const result = await controller.generateZone('douala-centre');

            expect(service.generateZone).toHaveBeenCalledWith('douala-centre');
            expect(result).toEqual(mockGenResponse);
        });
    });
});