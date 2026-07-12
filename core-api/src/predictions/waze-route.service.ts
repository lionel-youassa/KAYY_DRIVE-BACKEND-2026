import { Injectable } from '@nestjs/common';
import axios from 'axios';

export interface WazeSegment {
  latitude: number;
  longitude: number;
  speedKmh: number;
  freeFlowSpeedKmh: number;
  congestionRatio: number; // > 1.5 = dense, > 3 = bouchon
  lengthMeters: number;
  crossTimeSeconds: number;
  street: string;
}

export interface WazeRouteResult {
  segments: WazeSegment[];
  totalTimeSeconds: number;
  totalTimeFreeFlowSeconds: number;
  success: boolean;
}

@Injectable()
export class WazeRouteService {
  private readonly WAZE_URL =
    'https://routing-livemap-row.waze.com/RoutingManager/routingRequest';

  /**
   * Interroge l'API Waze LiveMap pour obtenir les conditions
   * de trafic en temps réel entre deux points.
   */
  async getRouteTraffic(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ): Promise<WazeRouteResult> {
    try {
      const response = await axios.get(this.WAZE_URL, {
        params: {
          from: `x:${startLng} y:${startLat}`,
          to: `x:${endLng} y:${endLat}`,
          returnJSON: 'true',
          returnGeometries: 'true',
          returnInstructions: 'false',
          timeout: '10000',
          nPaths: '1',
          options: 'AVOID_TRAILS:t',
        },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://www.waze.com/',
        },
        timeout: 8000,
      });

      const data = response.data;
      if (!data?.response?.results || data.response.results.length === 0) {
        return {
          segments: [],
          totalTimeSeconds: 0,
          totalTimeFreeFlowSeconds: 0,
          success: false,
        };
      }

      const results = data.response.results as any[];
      const segments: WazeSegment[] = [];
      let totalTime = 0;
      let totalTimeFreeFlow = 0;

      for (const seg of results) {
        const lengthMeters = seg.length ?? 0;
        const crossTime = seg.crossTime ?? 1;
        const crossTimeFreeFlow = seg.crossTimeFreeFlow ?? crossTime;

        // Calculer la vitesse en km/h à partir de la longueur et du temps
        const speedKmh = crossTime > 0 ? (lengthMeters / crossTime) * 3.6 : 50;
        const freeFlowSpeedKmh =
          crossTimeFreeFlow > 0 ? (lengthMeters / crossTimeFreeFlow) * 3.6 : 50;
        const congestionRatio =
          crossTimeFreeFlow > 0 ? crossTime / crossTimeFreeFlow : 1;

        // Extraire le point milieu du segment depuis path
        let lat = 0;
        let lng = 0;
        if (seg.path?.x != null && seg.path?.y != null) {
          lat = seg.path.y;
          lng = seg.path.x;
        } else if (seg.path && typeof seg.path === 'object') {
          // Si path est un objet avec les coordonnées
          lat = seg.path.y ?? 0;
          lng = seg.path.x ?? 0;
        }

        totalTime += crossTime;
        totalTimeFreeFlow += crossTimeFreeFlow;

        segments.push({
          latitude: lat,
          longitude: lng,
          speedKmh: Math.round(speedKmh * 10) / 10,
          freeFlowSpeedKmh: Math.round(freeFlowSpeedKmh * 10) / 10,
          congestionRatio: Math.round(congestionRatio * 100) / 100,
          lengthMeters,
          crossTimeSeconds: crossTime,
          street: seg.street?.toString() ?? '',
        });
      }

      return {
        segments,
        totalTimeSeconds: totalTime,
        totalTimeFreeFlowSeconds: totalTimeFreeFlow,
        success: true,
      };
    } catch (error) {
      console.warn('[WazeRouteService] Erreur appel Waze:', error?.message);
      return {
        segments: [],
        totalTimeSeconds: 0,
        totalTimeFreeFlowSeconds: 0,
        success: false,
      };
    }
  }

  /**
   * Pour un point donné et une liste de segments Waze,
   * retourne le segment le plus proche et sa vitesse.
   */
  findClosestSegment(
    lat: number,
    lng: number,
    segments: WazeSegment[],
  ): WazeSegment | null {
    if (segments.length === 0) return null;

    let closest: WazeSegment | null = null;
    let minDist = Infinity;

    for (const seg of segments) {
      if (seg.latitude === 0 && seg.longitude === 0) continue;
      const dist = this.haversineKm(lat, lng, seg.latitude, seg.longitude);
      if (dist < minDist) {
        minDist = dist;
        closest = seg;
      }
    }

    return minDist < 2 ? closest : null; // Max 2 km de distance
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
