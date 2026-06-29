import { Injectable, Logger } from '@nestjs/common';
import { LocalRouteDto, CoordinateDto } from './dto/local-route.dto';

@Injectable()
export class LocalRoutesService {
  private readonly logger = new Logger(LocalRoutesService.name);

  async getRelevantLocalRoutes(startCoords: CoordinateDto, endCoords: CoordinateDto): Promise<LocalRouteDto[]> {
    this.logger.log(`Recherche de routes locales pertinentes entre [${startCoords.latitude},${startCoords.longitude}] et [${endCoords.latitude},${endCoords.longitude}]`);

    // Données mockées pour simuler des routes locales (Tsors)
    // Ces routes devraient être stockées et récupérées par Atouga.
    const mockLocalRoutes: LocalRouteDto[] = [
      {
        id: 'tsor-douala-yaounde-shortcut',
        name: 'Raccourci N3 - Forêt',
        type: 'shortcut',
        condition: 'dry_season_only',
        priority: 8,
        coordinates: [
          { longitude: 10.0, latitude: 3.9 },
          { longitude: 10.05, latitude: 3.95 },
          { longitude: 10.1, latitude: 4.0 },
        ],
      },
      {
        id: 'tsor-yaounde-detour-pothole',
        name: 'Déviation Nid-de-poule Mvog-Ada',
        type: 'detour',
        condition: 'pothole_avoidance',
        priority: 9,
        coordinates: [
          { longitude: 11.5, latitude: 3.8 },
          { longitude: 11.51, latitude: 3.81 },
          { longitude: 11.52, latitude: 3.8 },
        ],
      },
    ];

    // Pour l'instant, on retourne toutes les routes mockées.
    // Plus tard, une logique de filtrage basée sur startCoords/endCoords sera ajoutée.
    return mockLocalRoutes;
  }
}
