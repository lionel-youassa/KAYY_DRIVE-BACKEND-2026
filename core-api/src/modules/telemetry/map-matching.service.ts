import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface MapMatchingResult {
  segmentId: string;
  matchedPoint: {
    latitude: number;
    longitude: number;
  };
  distance: number;
  confidence: number;
  segmentInfo: {
    vitesseMoyenne: number;
    estOfficiel: boolean;
    estInonde: boolean;
    scoreQualite: number;
  };
}

export interface TelemetryPoint {
  id_utilisateur: string;
  latitude: number;
  longitude: number;
  intensite: number;
  timestamp: Date;
}

@Injectable()
export class MapMatchingService {
  private readonly logger = new Logger(MapMatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Algorithme de Map-Matching pour lier un point GPS à un segment de route
   * Utilise PostGIS pour trouver le segment le plus proche
   */
  async matchTelemetryToSegment(
    point: TelemetryPoint,
  ): Promise<MapMatchingResult | null> {
    try {
      this.logger.log(
        `Map-Matching pour utilisateur ${point.id_utilisateur} à [${point.latitude}, ${point.longitude}]`,
      );

      // Requête PostGIS pour trouver le segment le plus proche
      // ST_DWithin trouve les segments dans un rayon de 50m
      // ST_Distance calcule la distance exacte
      const query = `
        SELECT 
          id,
          vitesse_moyenne,
          est_officiel,
          est_inonde,
          score_qualite,
          ST_AsGeoJSON(ST_ClosestPoint(path, ST_SetSRID(ST_MakePoint($1, $2), 4326))) as matched_point,
          ST_Distance(
            ST_Transform(path, 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857)
          ) as distance
        FROM segment_route
        WHERE ST_DWithin(
          ST_Transform(path, 3857),
          ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857),
          50
        )
        ORDER BY distance ASC
        LIMIT 1
      `;

      const result = await this.prisma.$queryRawUnsafe(
        query,
        point.longitude,
        point.latitude,
      );

      if (!result || result.length === 0) {
        this.logger.warn(
          `Aucun segment trouvé pour le point [${point.latitude}, ${point.longitude}]`,
        );
        return null;
      }

      const segment = result[0];
      const matchedPoint = JSON.parse(segment.matched_point);
      const distance = parseFloat(segment.distance);

      // Calcul de la confiance basé sur la distance
      // Plus le point est proche du segment, plus la confiance est élevée
      const confidence = this.calculateConfidence(distance);

      this.logger.log(
        `Segment trouvé: ${segment.id} à ${distance.toFixed(2)}m (confiance: ${(confidence * 100).toFixed(1)}%)`,
      );

      return {
        segmentId: segment.id,
        matchedPoint: {
          latitude: matchedPoint.coordinates[1],
          longitude: matchedPoint.coordinates[0],
        },
        distance,
        confidence,
        segmentInfo: {
          vitesseMoyenne: segment.vitesse_moyenne,
          estOfficiel: segment.est_officiel,
          estInonde: segment.est_inonde,
          scoreQualite: parseFloat(segment.score_qualite),
        },
      };
    } catch (error) {
      this.logger.error(`Erreur lors du Map-Matching: ${error.message}`);
      return null;
    }
  }

  /**
   * Map-Matching pour une séquence de points (trajet)
   * Utile pour reconstruire un itinéraire complet
   */
  async matchTrajectoryToSegments(
    points: TelemetryPoint[],
  ): Promise<MapMatchingResult[]> {
    const results: MapMatchingResult[] = [];

    for (const point of points) {
      const result = await this.matchTelemetryToSegment(point);
      if (result) {
        results.push(result);
      }
    }

    this.logger.log(
      `Map-Matching terminé: ${results.length}/${points.length} points matchés`,
    );
    return results;
  }

  /**
   * Met à jour les informations d'un segment suite à une détection
   * (ex: mise à jour du score de qualité suite à une secousse)
   */
  async updateSegmentFromTelemetry(
    segmentId: string,
    telemetry: TelemetryPoint,
  ): Promise<void> {
    try {
      // Si l'intensité est élevée, on peut dégrader le score de qualité du segment
      if (telemetry.intensite > 15) {
        const currentSegment = await this.prisma.segmentRoute.findUnique({
          where: { id: segmentId },
        });

        if (currentSegment) {
          const newScore = Math.max(0, currentSegment.scoreQualite - 0.1);
          await this.prisma.segmentRoute.update({
            where: { id: segmentId },
            data: { scoreQualite: newScore },
          });

          this.logger.log(
            `Score de qualité du segment ${segmentId} mis à jour: ${currentSegment.scoreQualite} -> ${newScore}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Erreur lors de la mise à jour du segment: ${error.message}`,
      );
    }
  }

  /**
   * Trouve les segments proches d'un point donné
   * Utile pour l'affichage sur la carte ou l'analyse
   */
  async findNearbySegments(
    latitude: number,
    longitude: number,
    radiusMeters: number = 100,
  ): Promise<any[]> {
    try {
      const query = `
        SELECT 
          id,
          vitesse_moyenne,
          est_officiel,
          est_inonde,
          score_qualite,
          ST_AsGeoJSON(path) as geometry,
          ST_Distance(
            ST_Transform(path, 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857)
          ) as distance
        FROM segment_route
        WHERE ST_DWithin(
          ST_Transform(path, 3857),
          ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857),
          $3
        )
        ORDER BY distance ASC
        LIMIT 10
      `;

      const results = await this.prisma.$queryRawUnsafe(
        query,
        longitude,
        latitude,
        radiusMeters,
      );

      return results.map((segment) => ({
        id: segment.id,
        vitesseMoyenne: segment.vitesse_moyenne,
        estOfficiel: segment.est_officiel,
        estInonde: segment.est_inonde,
        scoreQualite: parseFloat(segment.score_qualite),
        geometry: JSON.parse(segment.geometry),
        distance: parseFloat(segment.distance),
      }));
    } catch (error) {
      this.logger.error(
        `Erreur lors de la recherche de segments proches: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * Calcule un score de confiance basé sur la distance
   * Distance 0m = 100% confiance, Distance 50m = 0% confiance
   */
  private calculateConfidence(distance: number): number {
    const maxDistance = 50; // mètres
    if (distance >= maxDistance) return 0;
    return 1 - distance / maxDistance;
  }
}
