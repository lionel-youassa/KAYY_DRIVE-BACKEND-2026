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

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      throw new HttpException(
        'Les coordonnées doivent être des nombres valides.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const url = `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    try {
      this.logger.log(`Appel OSRM (Cameroun): ${url}`);
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
        // Pour cette première itération, nous allons juste ajouter une instruction de suggestion
        // et lister les routes locales pertinentes.
        finalInstructions.push({
          text: `Attention: ${relevantLocalRoutes.length} route(s) locale(s) alternative(s) ou raccourci(s) disponible(s).`,
          distance: 0,
          duration: 0,
          location: response.data.routes[0].geometry.coordinates[0], // Au début de la route
        });

        // On ajoute les routes locales suggérées à une section dédiée de la réponse
        suggestedLocalRoutes.push(...relevantLocalRoutes);
      }
      // --- Fin de la logique d'injection/suggestion ---

      // Calcul du trafic par tronçon pour colorer le tracé
      const traficParTroncon = await this.getTraficParTroncon(
        response.data.routes[0].geometry.coordinates,
      );

      return {
        duration: response.data.routes[0].duration,
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

    if (isNaN(startLat) || isNaN(startLng) || isNaN(endLat) || isNaN(endLng)) {
      throw new HttpException(
        'Les coordonnées doivent être des nombres valides.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `Calcul d'itinéraire intelligent entre [${startLat},${startLng}] et [${endLat},${endLng}]`,
    );

    try {
      // 1. Appel OSRM pour l'itinéraire de base
      const osrmUrl = `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
      const osrmResponse: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(osrmUrl),
      );

      if (osrmResponse.data.code !== 'Ok') {
        throw new HttpException(
          `Erreur OSRM: ${osrmResponse.data.message || "Impossible de calculer l'itinéraire"}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const osrmInstructions = this.parserService.parseInstructions(
        osrmResponse.data,
      );
      const baseDuration = osrmResponse.data.routes[0].duration;
      const baseDistance = osrmResponse.data.routes[0].distance;

      // 2. Récupération des routes locales pertinentes via le service de Cindy
      const startCoords: PointGPS = { latitude: startLat, longitude: startLng };
      const endCoords: PointGPS = { latitude: endLat, longitude: endLng };
      const relevantLocalRoutes = await this.routesService.suggererRaccourcis(
        startCoords,
        endCoords,
        1000,
      );

      // 3. Appel au service IA pour la prédiction de trafic
      let trafficPrediction: any = null;
      try {
        const iaUrl = `${this.iaServiceUrl}/ia/traffic`;
        const iaPayload = {
          latitude: startLat,
          longitude: startLng,
          timestamp: new Date(),
          meteo: 'soleil', // Pourrait être dynamique
        };
        const iaResponse: AxiosResponse<any> = await firstValueFrom(
          this.httpService.post(iaUrl, iaPayload),
        );
        trafficPrediction = iaResponse.data;
        this.logger.log(
          `Prédiction trafic: ${JSON.stringify(trafficPrediction)}`,
        );
      } catch (iaError) {
        this.logger.warn(`Service IA indisponible: ${iaError.message}`);
        trafficPrediction = {
          niveau_trafic: 'inconnu',
          temps_estime_minutes: Math.round(baseDuration / 60),
        };
      }

      // 4. Récupération des incidents sur le trajet (Hydro-Guard)
      let incidentsOnRoute: any[] = [];
      try {
        // Pour l'instant, on simule la récupération des incidents
        // Plus tard, on utilisera le service incidents pour filtrer par proximité du trajet
        this.logger.log('Récupération des incidents sur le trajet (simulée)');
        incidentsOnRoute = [
          {
            type: 'travaux',
            description: 'Travaux sur N3',
            latitude: (startLat + endLat) / 2,
            longitude: (startLng + endLng) / 2,
            statut: 'confirme',
          },
        ];
      } catch (incidentError) {
        this.logger.warn(
          `Service incidents indisponible: ${incidentError.message}`,
        );
      }

      // 5. Fusion et enrichissement des instructions
      const finalInstructions: any[] = [...osrmInstructions];

      // Ajout des alertes incidents
      if (incidentsOnRoute.length > 0) {
        finalInstructions.unshift({
          text: `⚠️ ${incidentsOnRoute.length} incident(s) signalé(s) sur votre trajet`,
          distance: 0,
          duration: 0,
          location: osrmResponse.data.routes[0].geometry.coordinates[0],
        });
      }

      // Ajout des suggestions de routes locales
      if (relevantLocalRoutes.length > 0) {
        finalInstructions.push({
          text: `💡 ${relevantLocalRoutes.length} route(s) locale(s) alternative(s) disponible(s)`,
          distance: 0,
          duration: 0,
          location: osrmResponse.data.routes[0].geometry.coordinates[0],
        });
      }

      // Ajout des informations de trafic
      if (trafficPrediction && trafficPrediction.niveau_trafic !== 'inconnu') {
        finalInstructions.push({
          text: `🚗 Trafic prévu: ${trafficPrediction.niveau_trafic} (+${trafficPrediction.temps_estime_minutes} min)`,
          distance: 0,
          duration: 0,
          location: osrmResponse.data.routes[0].geometry.coordinates[0],
        });
      }

      // Calcul du temps ajusté avec trafic
      const adjustedDuration =
        trafficPrediction && trafficPrediction.temps_estime_minutes
          ? baseDuration + trafficPrediction.temps_estime_minutes * 60
          : baseDuration;

      // 6. Calcul du trafic par tronçon pour colorer le tracé
      const traficParTroncon = await this.getTraficParTroncon(
        osrmResponse.data.routes[0].geometry.coordinates,
      );

      return {
        duration: adjustedDuration,
        distance: baseDistance,
        geometry: osrmResponse.data.routes[0].geometry,
        instructions: finalInstructions,
        suggestedLocalRoutes: relevantLocalRoutes,
        incidentsOnRoute: incidentsOnRoute,
        trafficPrediction: trafficPrediction,
        traficParTroncon: traficParTroncon, // Nouveau: segments colorés par trafic
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
