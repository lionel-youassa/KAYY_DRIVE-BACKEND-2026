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
    const LOCAL_HOTSPOTS = [
      {
        nom: 'Ndokotti',
        adresse: 'Carrefour Ndokotti, Douala, Cameroun',
        latitude: 4.0511,
        longitude: 9.7679,
      },
      {
        nom: 'Akwa',
        adresse: 'Akwa, Douala, Cameroun',
        latitude: 4.0503,
        longitude: 9.7082,
      },
      {
        nom: 'Bonanjo',
        adresse: 'Bonanjo, Douala, Cameroun',
        latitude: 4.0435,
        longitude: 9.6849,
      },
      {
        nom: 'Deido',
        adresse: 'Rond-point Deido, Douala, Cameroun',
        latitude: 4.0638,
        longitude: 9.7075,
      },
      {
        nom: 'Bonapriso',
        adresse: 'Bonapriso, Douala, Cameroun',
        latitude: 4.0298,
        longitude: 9.7042,
      },
      {
        nom: 'Bastos',
        adresse: 'Bastos, Yaoundé, Cameroun',
        latitude: 3.8902,
        longitude: 11.5122,
      },
      {
        nom: 'Mvan',
        adresse: 'Gare routière Mvan, Yaoundé, Cameroun',
        latitude: 3.8242,
        longitude: 11.5204,
      },
      {
        nom: 'Poste Centrale',
        adresse: 'Poste Centrale, Yaoundé, Cameroun',
        latitude: 3.8642,
        longitude: 11.5201,
      },
      {
        nom: 'Aéroport International de Douala',
        adresse: 'Aéroport de Douala, Cameroun',
        latitude: 4.0158,
        longitude: 9.7194,
      },
      {
        nom: 'Université de Douala',
        adresse: 'Esplanade Université de Douala, Cameroun',
        latitude: 4.0612,
        longitude: 9.7285,
      },
      {
        nom: 'Hôpital Général de Douala',
        adresse: 'Hôpital Général, Douala, Cameroun',
        latitude: 4.0616,
        longitude: 9.7571,
      },
      {
        nom: 'Logbessou',
        adresse: 'Logbessou, Douala, Cameroun',
        latitude: 4.0853,
        longitude: 9.7891,
      },
      {
        nom: 'Bonamoussadi',
        adresse: 'Bonamoussadi, Douala, Cameroun',
        latitude: 4.0811,
        longitude: 9.7425,
      },
      {
        nom: 'Kribi',
        adresse: 'Kribi, Cameroun',
        latitude: 2.9377,
        longitude: 9.9077,
      },
      {
        nom: 'Limbe',
        adresse: 'Limbe, Cameroun',
        latitude: 4.0125,
        longitude: 9.2205,
      },
    ];

    try {
      this.logger.log(`Searching for: ${query}`);

      const url = `${this.nominatimUrl}?q=${encodeURIComponent(query)}&format=json&limit=15&countrycodes=cm&addressdetails=1`;

      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            'User-Agent': 'KayyDriveApp/1.0 (support@kayydrive.com)',
          },
          timeout: 5000,
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
      if (results.length > 0) return results;
    } catch (error) {
      this.logger.error(`Error searching for ${query}: ${error.message}`);
    }

    // Local fallback search if Nominatim fails or returns empty results
    this.logger.log(`Using local fallback search for: ${query}`);
    const lowerQuery = query.toLowerCase();
    return LOCAL_HOTSPOTS.filter(
      (h) =>
        h.nom.toLowerCase().includes(lowerQuery) ||
        h.adresse.toLowerCase().includes(lowerQuery),
    ).map((h, index) => ({
      id: `local_${index}`,
      nom: h.nom,
      adresse: h.adresse,
      latitude: h.latitude,
      longitude: h.longitude,
    }));
  }

  async reverse(
    latitude: number,
    longitude: number,
  ): Promise<{ quartier?: string; ville?: string; region?: string }> {
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

      const quartier =
        address.suburb ||
        address.neighbourhood ||
        address.quarter ||
        address.residential ||
        address.townland ||
        '';
      const ville =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        '';
      const region = address.state || address.region || address.province || '';

      return {
        quartier: quartier ? quartier.trim() : undefined,
        ville: ville ? ville.trim() : undefined,
        region: region ? region.trim() : undefined,
      };
    } catch (error) {
      this.logger.error(
        `Error reverse geocoding [${latitude}, ${longitude}]: ${error.message}`,
      );
      return {};
    }
  }
}
