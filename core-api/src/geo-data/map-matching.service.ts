import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

interface ResultatMatch {
    segmentId: string;
    vitesseMoyenne: number;
    distanceMetres: number;
    snappedLng: number;
    snappedLat: number;
}

@Injectable()
export class MapMatchingService {
    private prisma = new PrismaClient();

    constructor() {}

    /**
     * Prend un point de secousse télémétrique et le "recolle" (snap) sur la route la plus proche
     * en calculant la distance exacte grâce au système géographique de PostGIS.
     */
    async matchVibrationToSegment(lng: number, lat: number, rayonMaxMetres: number = 25): Promise<ResultatMatch> {
        // Utilisation de requêtes SQL brutes géospatiales à cause du type Unsupported de Prisma
        const result = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id,
        "vitesseMoyenne",
        ST_X(ST_ClosestPoint(path, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))) as snapped_lng,
        ST_Y(ST_ClosestPoint(path, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))) as snapped_lat,
        ST_Distance(path::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) as distance_meters
      FROM "SegmentRoute"
      WHERE ST_DWithin(path::geography, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${rayonMaxMetres})
      ORDER BY distance_meters ASC
      LIMIT 1;
    `;

        if (!result || result.length === 0) {
            throw new NotFoundException("La secousse est trop éloignée de toutes les voies connues (Hors-piste).");
        }

        const segmentTrouve = result[0];

        return {
            segmentId: segmentTrouve.id,
            vitesseMoyenne: segmentTrouve.vitesseMoyenne,
            distanceMetres: segmentTrouve.distance_meters,
            snappedLng: segmentTrouve.snapped_lng,
            snappedLat: segmentTrouve.snapped_lat,
        };
    }
}