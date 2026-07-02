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
  async search(@Query('q') query: string) {
    if (!query || query.length < 2) {
      throw new HttpException(
        'Query must be at least 2 characters long',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const results = await this.geocodingService.search(query);
      return results;
    } catch (error) {
      throw new HttpException(
        'Error searching for location',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
