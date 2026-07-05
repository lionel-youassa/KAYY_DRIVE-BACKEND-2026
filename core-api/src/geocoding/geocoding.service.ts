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
          timeout: 2500, // Limiter à 2.5 secondes pour éviter le blocage
        }),
      );

      const results: GeocodeResult[] = response.data.map((item: any, index: number) => ({
        id: `${index}`,
        nom: item.display_name.split(',')[0],
        adresse: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));

      this.logger.log(`Found ${results.length} results for: ${query}`);
      return results;
    } catch (error) {
      this.logger.error(`Error searching for ${query}: ${error.message}`);
      return [];
    }
  }

  async reverse(latitude: number, longitude: number): Promise<{ quartier?: string; ville?: string; region?: string }> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`;
      this.logger.log(`Reverse geocoding: [${latitude}, ${longitude}]`);

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': 'KayyDrive/1.0',
          },
          timeout: 2500, // Limiter à 2.5 secondes pour éviter le blocage
        }),
      );

      const address = response.data?.address;
      if (!address) return {};

      const quartier = address.suburb || address.neighbourhood || address.quarter || address.residential || address.townland || '';
      const ville = address.city || address.town || address.village || address.municipality || '';
      const region = address.state || address.region || address.province || '';

      return {
        quartier: quartier ? quartier.trim() : undefined,
        ville: ville ? ville.trim() : undefined,
        region: region ? region.trim() : undefined,
      };
    } catch (error) {
      this.logger.error(`Error reverse geocoding [${latitude}, ${longitude}]: ${error.message}`);
      return {};
    }
  }
}
