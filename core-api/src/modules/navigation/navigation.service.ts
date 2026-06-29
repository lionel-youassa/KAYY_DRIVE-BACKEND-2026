import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GetRouteDto } from './dto/get-route.dto';
import { NavigationParserService } from './navigation-parser.service';
import { LocalRoutesService } from './local-routes.service';
import { CoordinateDto } from './dto/local-route.dto';
import { AxiosResponse } from 'axios';

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);
  private readonly osrmUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly parserService: NavigationParserService,
    private readonly localRoutesService: LocalRoutesService,
  ) {
    this.osrmUrl = this.configService.get<string>('OSRM_URL', 'http://osrm-backend:5000');
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
      throw new HttpException('Les coordonnées doivent être des nombres valides.', HttpStatus.BAD_REQUEST);
    }

    const url = `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;

    try {
      this.logger.log(`Appel OSRM (Cameroun): ${url}`);
      const response: AxiosResponse<any> = await firstValueFrom(this.httpService.get(url));

      if (response.data.code !== 'Ok') {
        throw new HttpException(
          `Erreur OSRM: ${response.data.message || 'Impossible de calculer l\'itinéraire'}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      const instructions = this.parserService.parseInstructions(response.data);

      // Récupération des routes locales pertinentes (mockées pour l'instant)
      const startCoords: CoordinateDto = { latitude: startLat, longitude: startLng };
      const endCoords: CoordinateDto = { latitude: endLat, longitude: endLng };
      const relevantLocalRoutes = await this.localRoutesService.getRelevantLocalRoutes(startCoords, endCoords);
      this.logger.log(`Routes locales mockées récupérées: ${relevantLocalRoutes.length}`);

      // --- Logique d'injection/suggestion des routes locales ---
      const finalInstructions = [...instructions]; // Copie des instructions OSRM
      const suggestedLocalRoutes = [];

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

      return {
        duration: response.data.routes[0].duration,
        distance: response.data.routes[0].distance,
        geometry: response.data.routes[0].geometry,
        instructions: finalInstructions, // Instructions enrichies
        suggestedLocalRoutes: suggestedLocalRoutes, // Routes locales suggérées
      };
    } catch (error) {
      this.logger.error(`Erreur OSRM: ${error.message}`);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Erreur de communication avec le moteur OSRM.', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getSmartRoute(query: GetRouteDto): Promise<any> {
    return this.getBasicRoute(query);
  }
}
