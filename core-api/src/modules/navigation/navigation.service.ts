import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GetRouteDto } from './dto/get-route.dto';
import { NavigationParserService } from './navigation-parser.service';
import { AxiosResponse } from 'axios';

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);
  private readonly osrmUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly parserService: NavigationParserService,
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

      return {
        duration: response.data.routes[0].duration,
        distance: response.data.routes[0].distance,
        geometry: response.data.routes[0].geometry,
        instructions: instructions,
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
