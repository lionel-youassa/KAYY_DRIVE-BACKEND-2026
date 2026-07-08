import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { GetRouteDto } from './dto/get-route.dto';
import { RerouteDto } from './dto/reroute.dto';

@Controller('route')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('basic')
  async getBasicRoute(@Query() query: GetRouteDto) {
    return this.navigationService.getBasicRoute(query);
  }

  @Get('smart')
  async getSmartRoute(@Query() query: GetRouteDto) {
    return this.navigationService.getSmartRoute(query);
  }

  @Post('reroute')
  async reroute(@Body() rerouteDto: RerouteDto) {
    return this.navigationService.reroute(
      rerouteDto.currentLat,
      rerouteDto.currentLng,
      rerouteDto.endLat,
      rerouteDto.endLng,
    );
  }

  @Post('snap-to-road')
  async snapToRoad(@Body('coordinates') coordinates: number[][]) {
    return this.navigationService.snapToRoad(coordinates);
  }
}
