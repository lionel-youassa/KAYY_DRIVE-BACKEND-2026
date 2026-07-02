import { Test, TestingModule } from '@nestjs/testing';
import { OfflineService } from './offline.service';
import { ConfigService } from '@nestjs/config';
import { HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';

// Mock partiel du module fs pour intercepter la vérification d'existence de fichiers
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    createReadStream: jest.fn().mockReturnValue('mock-read-stream'),
    mkdirSync: jest.fn(),
}));

describe('OfflineService', () => {
    let service: OfflineService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                OfflineService,
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, defaultValue: string) => defaultValue),
                    },
                },
            ],
        }).compile();

        service = module.get<OfflineService>(OfflineService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getAvailableZones', () => {
        it('devrait retourner les deux zones initialisées par défaut (douala et yaounde)', async () => {
            const zones = await service.getAvailableZones();
            expect(zones).toHaveLength(2);
            expect(zones[0].id).toBe('douala-center');
            expect(zones[1].id).toBe('yaounde-center');
        });
    });

    describe('getZoneMetadata', () => {
        it('devrait renvoyer les métadonnées valides si la zone existe', async () => {
            const metadata = await service.getZoneMetadata('douala-center');
            expect(metadata.id).toBe('douala-center');
            expect(metadata.minZoom).toBe(11);
            expect(metadata.format).toBe('mbtiles');
        });

        it('devrait lever une erreur NOT_FOUND si la zone n\'existe pas', async () => {
            await expect(service.getZoneMetadata('zone-inconnue')).rejects.toThrow(
                new HttpException('Zone non trouvée', HttpStatus.NOT_FOUND),
            );
        });
    });

    describe('downloadZone', () => {
        it('devrait renvoyer le stream et le chemin du fichier si le mbtiles existe', async () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);

            const result = await service.downloadZone('douala-center');

            expect(result.filename).toBe('douala-center.mbtiles');
            expect(result).toHaveProperty('stream');
        });

        it('devrait lever une erreur NOT_FOUND si le fichier physique MBTiles est absent ou si la zone n\'existe pas', async () => {
            // Cas 1 : Zone existante, mais fichier manquant
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            await expect(service.downloadZone('douala-center')).rejects.toThrow(
                new HttpException('Fichier de carte non disponible pour le téléchargement', HttpStatus.NOT_FOUND),
            );

            // Cas 2 : Zone inconnue
            await expect(service.downloadZone('zone-invalide')).rejects.toThrow(
                new HttpException('Zone non trouvée', HttpStatus.NOT_FOUND),
            );
        });
    });

    describe('generateZone', () => {
        it('devrait passer le statut en "available" après une simulation de génération réussie', async () => {
            // On accélère artificiellement le setTimeout de la simulation
            jest.useFakeTimers();

            const generationPromise = service.generateZone('yaounde-center');

            // Avance rapide du timer simulé dans le service
            jest.advanceTimersByTime(2000);

            const result = await generationPromise;

            expect(result.success).toBe(true);
            expect(result.size).toBe(50000000);

            // On re-vérifie que la zone est passée au statut "available".
            const zones = await service.getAvailableZones();
            const yaoundeZone = zones.find(z => z.id === 'yaounde-center');
            expect(yaoundeZone?.status).toBe('available');

            jest.useRealTimers();
        });

        it('devrait lever une erreur NOT_FOUND lors de la tentative de génération d\'une zone absente', async () => {
            await expect(service.generateZone('zone-inexistante')).rejects.toThrow(
                new HttpException('Zone non trouvée', HttpStatus.NOT_FOUND),
            );
        });
    });
});