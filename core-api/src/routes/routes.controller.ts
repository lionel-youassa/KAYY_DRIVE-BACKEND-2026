import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { VoteRouteDto } from './dto/vote-route.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('routes')
@UseGuards(AuthGuard)
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  // POST /routes
  @Post()
  async create(
    @Body() dto: CreateRouteDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const raccourci = await this.routesService.createRaccourci({
      nom: dto.nom,
      description: dto.description || '',
      pointDepart: dto.pointDepart,
      pointArrivee: dto.pointArrivee,
      trace: dto.trace,
      id_utilisateur_createur: user.uid,
    });
    return { success: true, raccourci };
  }

  // GET /routes
  @Get()
  async getAll() {
    const raccourcis = await this.routesService.getAllRaccourcis();
    return { routes: raccourcis };
  }

  // POST /routes/:id/voter
  @Post(':id/voter')
  async voter(
    @Param('id') id: string,
    @Body() dto: VoteRouteDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const result = await this.routesService.voterRaccourci(
      id,
      user.uid,
      dto.vote,
    );
    return { success: true, ...result };
  }

  // GET /routes/suggestions?departLat=&departLng=&arriveeLat=&arriveeLng=
  @Get('suggestions')
  async suggestions(
    @Query('departLat') departLat: string,
    @Query('departLng') departLng: string,
    @Query('arriveeLat') arriveeLat: string,
    @Query('arriveeLng') arriveeLng: string,
  ) {
    const raccourcis = await this.routesService.suggererRaccourcis(
      { latitude: parseFloat(departLat), longitude: parseFloat(departLng) },
      { latitude: parseFloat(arriveeLat), longitude: parseFloat(arriveeLng) },
    );
    return { suggestions: raccourcis, raccourcis };
  }
}
