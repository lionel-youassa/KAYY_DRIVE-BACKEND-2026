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

    try {
      if (coordinates.length === 1) {
        const nearestUrl = `${this.osrmUrl}/nearest/v1/driving/${coordsString}`;
        this.logger.log(`Nearest road OSRM: ${nearestUrl}`);
        const response: AxiosResponse<any> = await firstValueFrom(
          this.httpService.get(nearestUrl),
        );

        if (response.data.code !== 'Ok' || !response.data.waypoints || response.data.waypoints.length === 0) {
          this.logger.warn(`Nearest road OSRM failed`);
          return null;
        }

        return {
          snappedCoordinates: [response.data.waypoints[0].location],
          confidence: 1.0,
          distance: response.data.waypoints[0].distance,
          duration: 0,
        };
      }

      const url = `${this.osrmUrl}/match/v1/driving/${coordsString}?geometries=geojson&overview=full`;
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
    const useAlternatives = !isPedestrian;

    try {
      // 1. Appel OSRM pour les itinéraires de base + alternatives
      const maxAlternatives = useAlternatives ? 3 : 0;
      const osrmUrl = `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true${maxAlternatives > 0 ? `&alternatives=${maxAlternatives}` : ''}`;
      const osrmResponse: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(osrmUrl),
      );

      if (osrmResponse.data.code !== 'Ok') {
        throw new HttpException(
          `Erreur OSRM: ${osrmResponse.data.message || "Impossible de calculer l'itinéraire"}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 2. Récupérer tous les incidents actifs (inondations, travaux, routes dégradées, routes endommagées)
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

        const intersectedFloodIncidents = new Set<string>();
        const intersectedDegradedIncidents = new Set<string>();
        const intersectedTrafficIncidents = new Set<string>();

        for (const inc of activeIncidents) {
          if (inc.latitude == null || inc.longitude == null) continue;
          
          const isNear = routeCoords.some(coord => 
            distanceEnMetres(coord[1], coord[0], inc.latitude!, inc.longitude!) <= 150
          );

          if (isNear) {
            if (inc.type === 'INONDATION') {
              intersectedFloodIncidents.add(inc.id);
            } else if (inc.type === 'QUALITE_ROUTE' || inc.type === 'ROUTE_ENDOMMAGEE') {
              intersectedDegradedIncidents.add(inc.id);
            } else if (inc.type === 'TRAFIC') {
              intersectedTrafficIncidents.add(inc.id);
            }
          }
        }

        // Check recent shocks
        let hasDegradedShock = false;
        for (const shock of recentShocks) {
          const isNear = routeCoords.some(coord =>
            distanceEnMetres(coord[1], coord[0], shock.latitude, shock.longitude) <= 150
          );
          if (isNear) {
            hasDegradedShock = true;
            break;
          }
        }

        const floodCount = intersectedFloodIncidents.size;
        const degradedCount = intersectedDegradedIncidents.size + (hasDegradedShock ? 1 : 0);
        const trafficCount = intersectedTrafficIncidents.size;

        // Calcul du score de confort (0 à 100)
        let comfortScore = 100 - (floodCount * 40) - (degradedCount * 20) - (trafficCount * 10);
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

        // Durée virtuelle pénalisée : +30 min par inondation, +10 min par dégradation, +5 min par trafic
        const totalPenalty = (floodCount * 1800) + (degradedCount * 600) + (trafficCount * 300);
        const penalizedDuration = route.duration + totalPenalty;

        evaluatedRoutes.push({
          route,
          routeIndex,
          floodCount,
          degradedCount,
          trafficCount,
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
        // En mode confort, trier par score de confort DESC (meilleur d'abord), puis par durée pénalisée ASC
        evaluatedRoutes.sort((a, b) => {
          if (b.comfortScore !== a.comfortScore) return b.comfortScore - a.comfortScore;
          return a.penalizedDuration - b.penalizedDuration;
        });
      } else {
        // En mode rapide, trier uniquement par durée réelle ASC
        evaluatedRoutes.sort((a, b) => a.route.duration - b.route.duration);

        // Si le tracé le plus rapide a des dégradations (travaux ou route endommagée)
        if (evaluatedRoutes[0].degradedCount > 0) {
          // Rechercher s'il y a une alternative sans travaux
          const alternativeWithoutTravaux = evaluatedRoutes.find(r => r.degradedCount === 0);
          if (alternativeWithoutTravaux && alternativeWithoutTravaux !== evaluatedRoutes[0]) {
            const absoluteFastest = evaluatedRoutes[0];
            // Si le détour ne rallonge pas la durée de plus de 30%
            if (alternativeWithoutTravaux.route.duration <= absoluteFastest.route.duration * 1.3) {
              const index = evaluatedRoutes.indexOf(alternativeWithoutTravaux);
              if (index > -1) {
                evaluatedRoutes.splice(index, 1);
                evaluatedRoutes.unshift(alternativeWithoutTravaux);
              }
            }
          }
        }
      }

      let bestChoice = evaluatedRoutes[0];

      // En mode confort : si la meilleure route a encore des incidents, tenter un contournement précis au niveau de l'incident
      if (routingMode === 'confort' && (bestChoice.hasFlood || bestChoice.hasDegraded) && activeIncidents.length > 0) {
        try {
          // Trouver l'incident critique sur le tracé de bestChoice
          const criticalIncident = activeIncidents.find(inc =>
            inc.latitude != null && inc.longitude != null &&
            bestChoice.route.geometry.coordinates.some(coord =>
              distanceEnMetres(coord[1], coord[0], inc.latitude!, inc.longitude!) <= 150
            ) && inc.type === 'INONDATION'
          ) || activeIncidents.find(inc =>
            inc.latitude != null && inc.longitude != null &&
            bestChoice.route.geometry.coordinates.some(coord =>
              distanceEnMetres(coord[1], coord[0], inc.latitude!, inc.longitude!) <= 150
            ) && (inc.type === 'QUALITE_ROUTE' || inc.type === 'ROUTE_ENDOMMAGEE')
          );

          if (criticalIncident) {
            this.logger.log(`Incident critique détecté pour contournement : ${criticalIncident.type} à [${criticalIncident.latitude}, ${criticalIncident.longitude}]`);
            
            const coords = bestChoice.route.geometry.coordinates;
            let closestIdx = 0;
            let minDistance = Infinity;
            for (let i = 0; i < coords.length; i++) {
              const d = distanceEnMetres(coords[i][1], coords[i][0], criticalIncident.latitude!, criticalIncident.longitude!);
              if (d < minDistance) {
                minDistance = d;
                closestIdx = i;
              }
            }

            // Calculer la tangente locale
            let dx = 0;
            let dy = 0;
            if (closestIdx > 0 && closestIdx < coords.length - 1) {
              dx = coords[closestIdx + 1][0] - coords[closestIdx - 1][0];
              dy = coords[closestIdx + 1][1] - coords[closestIdx - 1][1];
            } else if (coords.length > 1) {
              const nextIdx = closestIdx === 0 ? 1 : closestIdx;
              const prevIdx = nextIdx - 1;
              dx = coords[nextIdx][0] - coords[prevIdx][0];
              dy = coords[nextIdx][1] - coords[prevIdx][1];
            }

            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = -dy / len;
            const py = dx / len;

            // Décalage perpendiculaire (gauche et droite, ~400 mètres)
            const offsets = [0.0036, -0.0036];
            let bestBypassEvaluation: any = null;

            for (const offsetVal of offsets) {
              const perpLng = coords[closestIdx][0] + px * offsetVal;
              const perpLat = coords[closestIdx][1] + py * offsetVal;

              const bypassUrl = `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${perpLng},${perpLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
              try {
                const bypassResponse: AxiosResponse<any> = await firstValueFrom(
                  this.httpService.get(bypassUrl),
                );

                if (bypassResponse.data.code === 'Ok' && bypassResponse.data.routes.length > 0) {
                  const bRoute = bypassResponse.data.routes[0];
                  const bCoords = bRoute.geometry.coordinates;

                  const bFloodIncidents = new Set<string>();
                  const bDegradedIncidents = new Set<string>();

                  for (const inc of activeIncidents) {
                    if (inc.latitude == null || inc.longitude == null) continue;
                    const isNear = bCoords.some(c =>
                      distanceEnMetres(c[1], c[0], inc.latitude!, inc.longitude!) <= 150
                    );
                    if (isNear) {
                      if (inc.type === 'INONDATION') bFloodIncidents.add(inc.id);
                      else if (inc.type === 'QUALITE_ROUTE' || inc.type === 'ROUTE_ENDOMMAGEE') bDegradedIncidents.add(inc.id);
                    }
                  }

                  const bFloodCount = bFloodIncidents.size;
                  const bDegradedCount = bDegradedIncidents.size;
                  const bComfort = 100 - (bFloodCount * 40) - (bDegradedCount * 20);

                  const evalResult = {
                    route: bRoute,
                    routeIndex: -1,
                    floodCount: bFloodCount,
                    degradedCount: bDegradedCount,
                    trafficCount: 0,
                    comfortScore: Math.max(0, bComfort),
                    comfortLevel: bComfort >= 80 ? 'excellent' : bComfort >= 60 ? 'bon' : bComfort >= 40 ? 'moyen' : 'mauvais',
                    recommendation: bFloodCount + bDegradedCount === 0
                      ? 'Itinéraire de contournement sûr (zones à risques évitées).'
                      : 'Itinéraire alternatif réduisant les zones à risques.',
                    penalizedDuration: bRoute.duration + (bFloodCount * 1800) + (bDegradedCount * 600),
                    hasFlood: bFloodCount > 0,
                    hasDegraded: bDegradedCount > 0,
                  };

                  if (bestBypassEvaluation === null || evalResult.comfortScore > bestBypassEvaluation.comfortScore ||
                      (evalResult.comfortScore === bestBypassEvaluation.comfortScore && evalResult.penalizedDuration < bestBypassEvaluation.penalizedDuration)) {
                    bestBypassEvaluation = evalResult;
                  }
                }
              } catch (e) {
                this.logger.warn(`Échec du calcul de déviation offset ${offsetVal}: ${e.message}`);
              }
            }

            if (bestBypassEvaluation && bestBypassEvaluation.comfortScore > bestChoice.comfortScore) {
              bestChoice = bestBypassEvaluation;
              this.logger.log(`Contournement d'incident appliqué avec succès. Confort amélioré : ${bestChoice.comfortScore}`);
            }
          }
        } catch (bypassError) {
          this.logger.warn(`Contournement impossible: ${bypassError.message}`);
        }
      }

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
                : incident.type === 'ROUTE_ENDOMMAGEE'
                  ? 'endomage'
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
