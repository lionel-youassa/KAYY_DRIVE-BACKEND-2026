import { Controller, Get, Query } from '@nestjs/common';
import { NavigationService } from './navigation.service';
import { GetRouteDto } from './dto/get-route.dto';

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
}
