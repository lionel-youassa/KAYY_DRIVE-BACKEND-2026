import { Injectable } from '@nestjs/common';
import { GetRouteDto } from './dto/get-route.dto';

@Injectable()
export class NavigationService {
  getBasicRoute(query: GetRouteDto): string {
    return `Basic route from OSRM for ${query.startLat},${query.startLng} to ${query.endLat},${query.endLng}.`;
  }

  getSmartRoute(query: GetRouteDto): string {
    return `Smart route for ${query.startLat},${query.startLng} to ${query.endLat},${query.endLng}.`;
  }
}
