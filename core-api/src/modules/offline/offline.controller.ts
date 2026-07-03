import {
  Controller,
  Get,
  Post,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { OfflineService } from './offline.service';

@Controller('offline')
export class OfflineController {
  constructor(private readonly offlineService: OfflineService) {}

  @Get('zones')
  async getAvailableZones() {
    const zones = await this.offlineService.getAvailableZones();
    return { zones };
  }

  @Get('zones/:zoneId/metadata')
  async getZoneMetadata(@Param('zoneId') zoneId: string) {
    return this.offlineService.getZoneMetadata(zoneId);
  }

  @Get('zones/:zoneId/download')
  async downloadZone(@Param('zoneId') zoneId: string) {
    return this.offlineService.downloadZone(zoneId);
  }

  @Post('zones/:zoneId/generate')
  async generateZone(@Param('zoneId') zoneId: string) {
    return this.offlineService.generateZone(zoneId);
  }
}
