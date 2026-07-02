import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface GeocodeResult {
  id: string;
  nom: string;
  adresse: string;
  latitude: number;
  longitude: number;
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';

  constructor(private readonly httpService: HttpService) {}

  async search(query: string): Promise<GeocodeResult[]> {
    try {
      this.logger.log(`Searching for: ${query}`);

      const url = `${this.nominatimUrl}?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=cm&addressdetails=1`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': 'KayyDrive/1.0',
          },
        }),
      );

      const results: GeocodeResult[] = response.data.map(
        (item: any, index: number) => ({
          id: `${index}`,
          nom: item.display_name.split(',')[0],
          adresse: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
        }),
      );

      this.logger.log(`Found ${results.length} results for: ${query}`);
      return results;
    } catch (error) {
      this.logger.error(`Error searching for ${query}: ${error.message}`);
      return [];
    }
  }
}
