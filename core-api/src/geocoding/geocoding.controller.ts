import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GeocodingService } from './geocoding.service';

@Controller('geocode')
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  async search(@Query('q') q: string, @Query('query') query: string) {
    const searchQuery = query || q;
    if (!searchQuery || searchQuery.length < 2) {
      throw new HttpException(
        'Query must be at least 2 characters long',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const results = await this.geocodingService.search(searchQuery);
      // Format de réponse compatible frontend
      return {
        results: results.map((r, index) => ({
          id: index.toString(),
          name: r.nom,
          display_name: r.adresse,
          address: r.adresse,
          lat: r.latitude,
          lon: r.longitude,
        })),
      };
    } catch (error) {
      throw new HttpException(
        'Error searching for location',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('reverse')
  async reverse(
    @Query('lat') lat: string,
    @Query('lon') lon: string,
    @Query('lng') lng: string,
  ) {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon || lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new HttpException(
        'Latitude and Longitude must be valid numbers',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const address = await this.geocodingService.reverse(latitude, longitude);
      return address;
    } catch (error) {
      throw new HttpException(
        'Error performing reverse geocoding',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
