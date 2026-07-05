import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GetRouteDto } from './dto/get-route.dto';
import { NavigationParserService } from './navigation-parser.service';
import { RoutesService, PointGPS } from '../../routes/routes.service';
import { AxiosResponse } from 'axios';
import { TraficService } from '../../trafic/trafic.service';
import { PrismaService } from '../../prisma/prisma.service';

function distanceEnMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);
  private readonly osrmUrl: string;
  private readonly iaServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly parserService: NavigationParserService,
    private readonly routesService: RoutesService,
    private readonly traficService: TraficService,
    private readonly prisma: PrismaService,
  ) {
    this.osrmUrl = this.configService.get<string>(
      'OSRM_URL',
      'http://osrm-backend:5000',
    );
    this.iaServiceUrl = this.configService.get<string>(
      'IA_SERVICE_URL',
      'http://ia-service:8000',
    );
  }

  /**
   * Snap-to-road : Recale les coordonnées GPS sur la route la plus proche
   * Utilise l'endpoint OSRM /match pour éviter que le point ne tremble
   */
  async snapToRoad(coordinates: number[][]): Promise<any> {
    const coordsString = coordinates
      .map((coord) => `${coord[0]},${coord[1]}`)
      .join(';');

    const url = `${this.osrmUrl}/matching/v1/driving/${coordsString}?geometries=geojson&overview=full`;

    try {
      this.logger.log(`Snap-to-road OSRM: ${url}`);
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url),
      );

      if (response.data.code !== 'Ok') {
        this.logger.warn(
          `Snap-to-road OSRM: ${response.data.message || "Impossible de recaler les coordonnées"}`,
        );
        return null;
      }

      return {
        snappedCoordinates: response.data.matchings[0].geometry.coordinates,
        confidence: response.data.matchings[0].confidence,
        distance: response.data.matchings[0].distance,
        duration: response.data.matchings[0].duration,
      };
    } catch (error) {
      this.logger.error(`Erreur snap-to-road: ${error.message}`);
      return null;
    }
  }

  /**
   * Calcule le trafic par tronçon de route
   * Retourne un tableau de segments avec leur niveau de trafic
   */
  private async getTraficParTroncon(
    coordinates: number[][],
  ): Promise<Array<{ start: number[]; end: number[]; niveau: string; vitesse: number }>> {
    const segments: Array<{ start: number[]; end: number[]; niveau: string; vitesse: number }> = [];
    const step = Math.max(1, Math.floor(coordinates.length / 10)); // Max 10 segments

    for (let i = 0; i < coordinates.length - 1; i += step) {
      const start = coordinates[i];
      const end = coordinates[Math.min(i + step, coordinates.length - 1)];
      
      // Calcul du point médian du segment
      const midLat = (start[1] + end[1]) / 2;
      const midLng = (start[0] + end[0]) / 2;

      // Récupération du trafic à ce point
      try {
        const trafic = await this.traficService.getTraficActuel(midLat, midLng, 500);

        // Conversion du niveau en code couleur
        let niveauCouleur = 'vert'; // fluide
        if (trafic.niveau === 'dense') niveauCouleur = 'orange';
        if (trafic.niveau === 'bouchon') niveauCouleur = 'rouge';

        segments.push({
          start,
          end,
          niveau: niveauCouleur,
          vitesse: trafic.vitesseMoyenne,
        });
      } catch (error) {
        this.logger.warn(`Erreur lors de la récupération du trafic pour le segment: ${error.message}`);
        segments.push({
          start,
          end,
          niveau: 'vert',
          vitesse: 0,
        });
      }
    }

    return segments;
  }

  /**
   * Recalcule automatique l'itinéraire si l'utilisateur s'éloigne du tracé
   * Appelé par le frontend quand l'utilisateur est à plus de 50m du tracé
   */
  async reroute(
    currentLat: number,
    currentLng: number,
    endLat: number,
    endLng: number,
  ): Promise<any> {
    this.logger.log(
      `Recalcule d'itinéraire depuis [${currentLat},${currentLng}] vers [${endLat},${endLng}]`,
    );

    return this.getSmartRoute({
      startLat: currentLat,
      startLng: currentLng,
      endLat: endLat,
      endLng: endLng,
    });
  }

  async getBasicRoute(query: GetRouteDto): Promise<any> {
    const startLatStr = query.startLat.toString();
    const startLngStr = query.startLng.toString();
    const endLatStr = query.endLat.toString();
    const endLngStr = query.endLng.toString();

    const startLat = parseFloat(startLatStr);
    const startLng = parseFloat(startLngStr);
    const endLat = parseFloat(endLatStr);
    const endLng = parseFloat(endLngStr);
    const isPedestrian = query.mode === 'pedestrian';

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      throw new HttpException(
        'Les coordonnées doivent être des nombres valides.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    try {
      this.logger.log(`Appel OSRM (Cameroun, mode: ${query.mode || 'driving'}): ${url}`);
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url),
      );

      if (response.data.code !== 'Ok') {
        throw new HttpException(
          `Erreur OSRM: ${response.data.message || "Impossible de calculer l'itinéraire"}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const instructions = this.parserService.parseInstructions(response.data);

      // Récupération des routes locales pertinentes via le service de Cindy
      const startCoords: PointGPS = { latitude: startLat, longitude: startLng };
      const endCoords: PointGPS = { latitude: endLat, longitude: endLng };
      const relevantLocalRoutes = await this.routesService.suggererRaccourcis(
        startCoords,
        endCoords,
        1000,
      );
      this.logger.log(
        `Routes locales récupérées: ${relevantLocalRoutes.length}`,
      );

      // --- Logique d'injection/suggestion des routes locales ---
      const finalInstructions: any[] = [...instructions]; // Copie des instructions OSRM
      const suggestedLocalRoutes: any[] = [];

      if (relevantLocalRoutes.length > 0) {
        finalInstructions.push({
          text: `Attention: ${relevantLocalRoutes.length} route(s) locale(s) alternative(s) ou raccourci(s) disponible(s).`,
          distance: 0,
          duration: 0,
          location: response.data.routes[0].geometry.coordinates[0], // Au début de la route
        });

        suggestedLocalRoutes.push(...relevantLocalRoutes);
      }

      // Calcul du trafic par tronçon pour colorer le tracé
      const coordinates = response.data.routes[0].geometry.coordinates;
      const traficParTroncon = isPedestrian
        ? coordinates.slice(0, -1).map((coord, idx) => ({
            start: coord,
            end: coordinates[idx + 1],
            niveau: 'vert',
            vitesse: 5,
          }))
        : await this.getTraficParTroncon(coordinates);

      const baseDuration = response.data.routes[0].duration;
      const finalDuration = isPedestrian
        ? Math.round(response.data.routes[0].distance / 1.3888)
        : baseDuration;

      return {
        duration: finalDuration,
        distance: response.data.routes[0].distance,
        geometry: response.data.routes[0].geometry,
        instructions: finalInstructions, // Instructions enrichies
        suggestedLocalRoutes: suggestedLocalRoutes, // Routes locales suggérées
        traficParTroncon: traficParTroncon, // Segments colorés par trafic
      };
    } catch (error) {
      this.logger.error(`Erreur OSRM: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        'Erreur de communication avec le moteur OSRM.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getSmartRoute(query: GetRouteDto): Promise<any> {
    const startLatStr = query.startLat.toString();
    const startLngStr = query.startLng.toString();
    const endLatStr = query.endLat.toString();
    const endLngStr = query.endLng.toString();

    const startLat = parseFloat(startLatStr);
    const startLng = parseFloat(startLngStr);
    const endLat = parseFloat(endLatStr);
    const endLng = parseFloat(endLngStr);
    const isPedestrian = query.mode === 'pedestrian';

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      throw new HttpException(
        'Les coordonnées doivent être des nombres valides.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Calcul d'itinéraire intelligent (mode: ${query.mode || 'driving'}, profil: ${query.routingMode || 'confort'}) entre [${startLat},${startLng}] et [${endLat},${endLng}]`,
    );

    const routingMode = query.routingMode || 'confort';
    const useAlternatives = routingMode === 'confort' && !isPedestrian;

    try {
      // 1. Appel OSRM pour les itinéraires de base + alternatives si mode confort
      const osrmUrl = `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true${useAlternatives ? '&alternatives=true' : ''}`;
      const osrmResponse: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(osrmUrl),
      );

      if (osrmResponse.data.code !== 'Ok') {
        throw new HttpException(
          `Erreur OSRM: ${osrmResponse.data.message || "Impossible de calculer l'itinéraire"}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Récupérer tous les incidents actifs (inondations, travaux, routes dégradées)
      const activeIncidents = await this.prisma.incident.findMany({
        where: {
          dateExpiration: { gt: new Date() },
          statut: { not: 'resolu' },
        },
      });

      // Récupérer les secousses récentes de forte intensité
      const recentShocks = await this.prisma.secousseData.findMany({
        where: {
          intensite: { gte: 8.0 },
          timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      const evaluatedRoutes: any[] = [];

      for (let routeIndex = 0; routeIndex < osrmResponse.data.routes.length; routeIndex++) {
        const route = osrmResponse.data.routes[routeIndex];
        const routeCoords = route.geometry.coordinates; // [[lng, lat], ...]

        let floodCount = 0;
        let degradedCount = 0;

        for (const coord of routeCoords) {
          const lng = coord[0];
          const lat = coord[1];

          // HydroGuard check (inondation à moins de 100m)
          const hasFlood = activeIncidents.some(inc => 
            inc.type === 'INONDATION' && 
            distanceEnMetres(lat, lng, inc.latitude!, inc.longitude!) <= 100
          );
          if (hasFlood) {
            floodCount++;
          }

          // SafeDrive check (route dégradée ou secousse importante à moins de 100m)
          const hasDegradedIncident = activeIncidents.some(inc => 
            inc.type === 'QUALITE_ROUTE' && 
            distanceEnMetres(lat, lng, inc.latitude!, inc.longitude!) <= 100
          );
          const hasDegradedShock = recentShocks.some(shock => 
            distanceEnMetres(lat, lng, shock.latitude, shock.longitude) <= 100
          );

          if (hasDegradedIncident || hasDegradedShock) {
            degradedCount++;
          }
        }

        // Calcul du score de confort (0 à 100)
        let comfortScore = 100 - (floodCount * 40) - (degradedCount * 20);
        comfortScore = Math.max(0, Math.min(100, comfortScore));

        // Déterminer le niveau et la recommandation
        let comfortLevel = 'excellent';
        let recommendation = 'Route sûre, excellent état.';
        if (comfortScore >= 80) {
          comfortLevel = 'excellent';
          recommendation = 'Route sûre, excellent état.';
        } else if (comfortScore >= 60) {
          comfortLevel = 'bon';
          recommendation = 'Route en bon état général.';
        } else if (comfortScore >= 40) {
          comfortLevel = 'moyen';
          recommendation = 'Route dégradée détectée, ralentissez et soyez vigilant.';
        } else {
          comfortLevel = 'mauvais';
          recommendation = 'Route très dégradée ou inondation signalée, prudence extrême ou contournement conseillé !';
        }

        // Durée virtuelle pénalisée : +30 min par inondation, +10 min par dégradation
        const totalPenalty = (floodCount * 1800) + (degradedCount * 600);
        const penalizedDuration = route.duration + totalPenalty;

        evaluatedRoutes.push({
          route,
          routeIndex,
          floodCount,
          degradedCount,
          comfortScore,
          comfortLevel,
          recommendation,
          penalizedDuration,
          hasFlood: floodCount > 0,
          hasDegraded: degradedCount > 0,
        });
      }

      // Sélection de l'itinéraire optimal
      if (routingMode === 'confort') {
        evaluatedRoutes.sort((a, b) => a.penalizedDuration - b.penalizedDuration);
      } else {
        evaluatedRoutes.sort((a, b) => a.route.duration - b.route.duration);
      }

      const bestChoice = evaluatedRoutes[0];
      const selectedRoute = bestChoice.route;
      const selectedRouteIndex = bestChoice.routeIndex;

      // 3. Extraction des instructions pour l'itinéraire choisi
      const osrmInstructions = this.parserService.parseInstructions(
        osrmResponse.data,
        selectedRouteIndex,
      );
      const baseDistance = selectedRoute.distance;
      const baseDuration = isPedestrian
        ? Math.round(baseDistance / 1.3888)
        : selectedRoute.duration;

      // 4. Récupération des routes locales alternatives de Cindy
      const startCoords: PointGPS = { latitude: startLat, longitude: startLng };
      const endCoords: PointGPS = { latitude: endLat, longitude: endLng };
      const relevantLocalRoutes = await this.routesService.suggererRaccourcis(
        startCoords,
        endCoords,
        1000,
      );

      // 5. Récupération de la prédiction du trafic IA (seulement pour véhicule)
      let trafficPrediction: any = null;
      if (!isPedestrian) {
        try {
          const iaUrl = `${this.iaServiceUrl}/ia/traffic`;
          const iaPayload = {
            latitude: startLat,
            longitude: startLng,
            timestamp: new Date(),
            meteo: 'soleil',
          };
          const iaResponse: AxiosResponse<any> = await firstValueFrom(
            this.httpService.post(iaUrl, iaPayload),
          );
          trafficPrediction = iaResponse.data;
        } catch (iaError) {
          this.logger.warn(`Service IA indisponible: ${iaError.message}`);
          trafficPrediction = {
            niveau_trafic: 'inconnu',
            temps_estime_minutes: Math.round(baseDuration / 60),
          };
        }
      }

      // 6. Filtrage des incidents réels situés à moins de 100m du tracé choisi
      const incidentsOnRoute: any[] = [];
      const selectedRouteCoords = selectedRoute.geometry.coordinates;

      for (const incident of activeIncidents) {
        if (!incident.latitude || !incident.longitude) continue;
        const isNearRoute = selectedRouteCoords.some(coord => 
          distanceEnMetres(incident.latitude!, incident.longitude!, coord[1], coord[0]) <= 100
        );
        if (isNearRoute) {
          incidentsOnRoute.push({
            id: incident.id,
            type: incident.type === 'INONDATION'
              ? 'inondation'
              : incident.type === 'QUALITE_ROUTE'
                ? 'travaux'
                : 'accident',
            description: incident.description,
            latitude: incident.latitude,
            longitude: incident.longitude,
            statut: incident.statut,
          });
        }
      }

      // 7. Fusion et enrichissement des instructions
      const finalInstructions: any[] = [...osrmInstructions];

      // Ajout des alertes incidents
      if (incidentsOnRoute.length > 0) {
        finalInstructions.unshift({
          text: `⚠️ ${incidentsOnRoute.length} incident(s) signalé(s) sur votre trajet`,
          distance: 0,
          duration: 0,
          location: selectedRoute.geometry.coordinates[0],
        });
      }

      // Ajout des suggestions de routes locales
      if (relevantLocalRoutes.length > 0) {
        finalInstructions.push({
          text: `💡 ${relevantLocalRoutes.length} route(s) locale(s) alternative(s) disponible(s)`,
          distance: 0,
          duration: 0,
          location: selectedRoute.geometry.coordinates[0],
        });
      }

      // Ajout des informations de trafic
      if (trafficPrediction && trafficPrediction.niveau_trafic !== 'inconnu') {
        finalInstructions.push({
          text: `🚗 Trafic prévu: ${trafficPrediction.niveau_trafic} (+${trafficPrediction.temps_estime_minutes} min)`,
          distance: 0,
          duration: 0,
          location: selectedRoute.geometry.coordinates[0],
        });
      }

      // Calcul du temps ajusté avec trafic
      const adjustedDuration =
        trafficPrediction && trafficPrediction.temps_estime_minutes
          ? baseDuration + trafficPrediction.temps_estime_minutes * 60
          : baseDuration;

      // 8. Calcul du trafic par tronçon pour colorer le tracé choisi
      const coordinates = selectedRoute.geometry.coordinates;
      const traficParTroncon = isPedestrian
        ? coordinates.slice(0, -1).map((coord, idx) => ({
            start: coord,
            end: coordinates[idx + 1],
            niveau: 'vert',
            vitesse: 5,
          }))
        : await this.getTraficParTroncon(coordinates);

      return {
        duration: adjustedDuration,
        distance: baseDistance,
        geometry: selectedRoute.geometry,
        instructions: finalInstructions,
        suggestedLocalRoutes: relevantLocalRoutes,
        incidentsOnRoute: incidentsOnRoute,
        trafficPrediction: trafficPrediction,
        traficParTroncon: traficParTroncon,
        comfortScore: bestChoice.comfortScore,
        comfortLevel: bestChoice.comfortLevel,
        recommendation: bestChoice.recommendation,
        routingMode: routingMode,
        hasFlood: bestChoice.hasFlood,
        hasDegraded: bestChoice.hasDegraded,
        smartFeatures: {
          trafficEnabled: trafficPrediction !== null,
          localRoutesEnabled: relevantLocalRoutes.length > 0,
          incidentsEnabled: incidentsOnRoute.length > 0,
        },
      };
    } catch (error) {
      this.logger.error(`Erreur dans getSmartRoute: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        "Erreur lors du calcul d'itinéraire intelligent.",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
