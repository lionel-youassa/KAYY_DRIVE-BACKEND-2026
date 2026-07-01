import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export interface RouteRecalculationEvent {
  routeId: string;
  userId: string;
  eventType:
    'incident' | 'traffic_change' | 'weather_change' | 'local_route_added';
  eventData: any;
  currentRoute: any;
  timestamp: Date;
}

@Injectable()
export class RouteRecalculationService {
  private readonly logger = new Logger(RouteRecalculationService.name);
  private readonly activeRoutes = new Map<string, any>(); // routeId -> route data

  constructor(
    @InjectQueue('route-recalculation')
    private readonly recalculationQueue: Queue,
  ) {}

  // Enregistrer une route active pour le suivi
  registerActiveRoute(routeId: string, userId: string, routeData: any): void {
    this.activeRoutes.set(routeId, {
      userId,
      routeData,
      registeredAt: new Date(),
    });
    this.logger.log(
      `Route active enregistrée: ${routeId} pour utilisateur ${userId}`,
    );
  }

  // Désenregistrer une route active
  unregisterActiveRoute(routeId: string): void {
    this.activeRoutes.delete(routeId);
    this.logger.log(`Route active désenregistrée: ${routeId}`);
  }

  // Déclencher un recalcul proactif suite à un événement
  async triggerRecalculation(event: RouteRecalculationEvent): Promise<void> {
    this.logger.log(
      `Déclenchement recalcul proactif pour route ${event.routeId} - événement: ${event.eventType}`,
    );

    // Vérifier si la route est toujours active
    const activeRoute = this.activeRoutes.get(event.routeId);
    if (!activeRoute) {
      this.logger.warn(`Route ${event.routeId} n'est plus active, ignoré`);
      return;
    }

    // Ajouter à la queue de recalcul
    await this.recalculationQueue.add('recalculate-route', event, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        count: 10,
      },
      removeOnFail: {
        count: 5,
      },
    });
  }

  // Vérifier si un événement impacte une route active
  async checkEventImpact(eventType: string, eventData: any): Promise<string[]> {
    const impactedRoutes: string[] = [];

    for (const [routeId, routeData] of this.activeRoutes.entries()) {
      const isImpacted = await this.isRouteImpacted(
        routeData.routeData,
        eventType,
        eventData,
      );
      if (isImpacted) {
        impactedRoutes.push(routeId);
      }
    }

    return impactedRoutes;
  }

  // Logique de détermination d'impact
  private async isRouteImpacted(
    routeData: any,
    eventType: string,
    eventData: any,
  ): Promise<boolean> {
    switch (eventType) {
      case 'incident':
        // Vérifier si l'incident est proche du trajet
        return this.isIncidentNearRoute(routeData, eventData);
      case 'traffic_change':
        // Vérifier si le changement de trafic affecte le trajet
        return this.isTrafficChangeRelevant(routeData, eventData);
      case 'weather_change':
        // Vérifier si les conditions météo affectent le trajet
        return this.isWeatherChangeRelevant(routeData, eventData);
      case 'local_route_added':
        // Vérifier si la nouvelle route locale est pertinente
        return this.isLocalRouteRelevant(routeData, eventData);
      default:
        return false;
    }
  }

  // Vérifier si un incident est proche du trajet
  private isIncidentNearRoute(routeData: any, incidentData: any): boolean {
    // Pour l'instant, vérification simple par distance
    // Plus tard, utiliser une vérification géospatiale plus précise
    const { geometry } = routeData;
    const { latitude, longitude } = incidentData;

    if (!geometry || !geometry.coordinates) return false;

    // Vérifier si l'incident est à moins de 500m d'un point du trajet
    for (const coord of geometry.coordinates) {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        coord[1], // latitude
        coord[0], // longitude
      );
      if (distance < 500) {
        return true;
      }
    }

    return false;
  }

  // Vérifier si le changement de trafic est pertinent
  private isTrafficChangeRelevant(routeData: any, trafficData: any): boolean {
    // Pour l'instant, on considère tout changement de trafic comme pertinent
    // Plus tard, affiner selon le segment de route
    return true;
  }

  // Vérifier si le changement météo est pertinent
  private isWeatherChangeRelevant(routeData: any, weatherData: any): boolean {
    // Pour l'instant, on considère les conditions météo sévères comme pertinentes
    const severeConditions = ['orage', 'pluie_intense', 'brouillard_dense'];
    return severeConditions.includes(weatherData.condition);
  }

  // Vérifier si la route locale est pertinente
  private isLocalRouteRelevant(routeData: any, localRouteData: any): boolean {
    // Vérifier si la route locale est proche du départ ou de l'arrivée
    const { startLat, startLng, endLat, endLng } = routeData;
    const { pointDepart, pointArrivee } = localRouteData;

    const distanceFromStart = this.calculateDistance(
      startLat,
      startLng,
      pointDepart.latitude,
      pointDepart.longitude,
    );

    const distanceFromEnd = this.calculateDistance(
      endLat,
      endLng,
      pointArrivee.latitude,
      pointArrivee.longitude,
    );

    return distanceFromStart < 1000 || distanceFromEnd < 1000;
  }

  // Calcul de distance entre deux points GPS
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371000; // Rayon de la Terre en mètres
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Obtenir les statistiques des routes actives
  getActiveRoutesStats(): any {
    return {
      total: this.activeRoutes.size,
      routes: Array.from(this.activeRoutes.entries()).map(
        ([routeId, data]) => ({
          routeId,
          userId: data.userId,
          registeredAt: data.registeredAt,
        }),
      ),
    };
  }
}
