import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface OfflineZone {
  id: string;
  name: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  size: number;
  lastUpdated: string;
  status: 'available' | 'generating' | 'error';
}

export interface ZoneMetadata {
  id: string;
  name: string;
  description: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  minZoom: number;
  maxZoom: number;
  format: string;
  size: number;
  tileCount: number;
  lastGenerated: string;
}

@Injectable()
export class OfflineService {
  private readonly logger = new Logger(OfflineService.name);
  private readonly offlineDir: string;
  private readonly zones: Map<string, OfflineZone> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.offlineDir = this.configService.get<string>('OFFLINE_DIR', './data/offline');
    this.initializeZones();
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    if (!existsSync(this.offlineDir)) {
      mkdirSync(this.offlineDir, { recursive: true });
      this.logger.log(`Répertoire offline créé: ${this.offlineDir}`);
    }
  }

  private initializeZones() {
    // Zones prédéfinies pour Douala et Yaoundé
    this.zones.set('douala', {
      id: 'douala',
      name: 'Douala',
      bounds: {
        north: 4.1,
        south: 4.0,
        east: 9.8,
        west: 9.7,
      },
      size: 0,
      lastUpdated: new Date().toISOString(),
      status: 'available',
    });

    this.zones.set('yaounde', {
      id: 'yaounde',
      name: 'Yaoundé',
      bounds: {
        north: 3.9,
        south: 3.8,
        east: 11.6,
        west: 11.4,
      },
      size: 0,
      lastUpdated: new Date().toISOString(),
      status: 'available',
    });
  }

  async getAvailableZones(): Promise<OfflineZone[]> {
    return Array.from(this.zones.values());
  }

  async getZoneMetadata(zoneId: string): Promise<ZoneMetadata> {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new HttpException('Zone non trouvée', HttpStatus.NOT_FOUND);
    }

    const mbtilesPath = join(this.offlineDir, `${zoneId}.mbtiles`);

    if (!existsSync(mbtilesPath)) {
      // Retourner les métadonnées par défaut si le fichier n'existe pas encore
      return {
        id: zone.id,
        name: zone.name,
        description: `Carte hors-ligne pour ${zone.name}`,
        bounds: zone.bounds,
        minZoom: 10,
        maxZoom: 18,
        format: 'pbf',
        size: 0,
        tileCount: 0,
        lastGenerated: 'Non généré',
      };
    }

    // Pour l'instant, retourner des métadonnées simulées
    // Plus tard, utiliser sqlite3 pour lire les métadonnées réelles du fichier MBTiles
    return {
      id: zone.id,
      name: zone.name,
      description: `Carte hors-ligne pour ${zone.name}`,
      bounds: zone.bounds,
      minZoom: 10,
      maxZoom: 18,
      format: 'pbf',
      size: 50000000, // 50MB simulé
      tileCount: 100000,
      lastGenerated: zone.lastUpdated,
    };
  }

  async downloadZone(zoneId: string) {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new HttpException('Zone non trouvée', HttpStatus.NOT_FOUND);
    }

    const mbtilesPath = join(this.offlineDir, `${zoneId}.mbtiles`);

    if (!existsSync(mbtilesPath)) {
      throw new HttpException('Fichier MBTiles non disponible pour cette zone', HttpStatus.NOT_FOUND);
    }

    // Retourner le fichier pour téléchargement
    return {
      filename: `${zoneId}.mbtiles`,
      path: mbtilesPath,
      size: zone.size,
    };
  }

  async generateZone(zoneId: string) {
    const zone = this.zones.get(zoneId);
    if (!zone) {
      throw new HttpException('Zone non trouvée', HttpStatus.NOT_FOUND);
    }

    this.logger.log(`Génération MBTiles pour zone: ${zoneId}`);
    zone.status = 'generating';

    try {
      // Simulation de la génération MBTiles
      // Dans une implémentation réelle, cela utiliserait:
      // - tile-join (Mapbox)
      // - ou un générateur personnalisé avec OSM data
      
      await this.simulateMBTilesGeneration(zoneId);

      zone.status = 'available';
      zone.lastUpdated = new Date().toISOString();
      zone.size = 50000000; // 50MB simulé

      this.logger.log(`Génération MBTiles terminée pour zone: ${zoneId}`);
      
      return {
        success: true,
        message: `Zone ${zoneId} générée avec succès`,
        zoneId,
        size: zone.size,
      };
    } catch (error) {
      zone.status = 'error';
      this.logger.error(`Erreur lors de la génération MBTiles pour ${zoneId}: ${error.message}`);
      throw new HttpException('Erreur lors de la génération MBTiles', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async simulateMBTilesGeneration(zoneId: string): Promise<void> {
    // Simulation de la génération (délai de 2 secondes)
    return new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
