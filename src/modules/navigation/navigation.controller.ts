import { Controller, Get, Query, ApiTags, ApiOperation } from '@nestjs/swagger';
import { NavigationService } from './navigation.service';
import { GetRouteDto } from './dto/get-route.dto';

@ApiTags('navigation')
@Controller('route')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('basic')
  @ApiOperation({ summary: 'Obtenir un itinéraire basique via OSRM' })
  getBasicRoute(@Query() query: GetRouteDto) {
    return this.navigationService.getBasicRoute(query);
  }

  @Get('smart')
  @ApiOperation({ summary: 'Obtenir un itinéraire "Smart" orchestré' })
  getSmartRoute(@Query() query: GetRouteDto) {
    return this.navigationService.getSmartRoute(query);
  }
}
