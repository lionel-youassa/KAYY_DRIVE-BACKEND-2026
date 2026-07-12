import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TraficService } from './trafic.service';
import { CreateTraficDto } from './dto/create-trafic.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserProfile } from '../auth/auth.service';

@Controller('trafic')
@UseGuards(AuthGuard)
export class TraficController {
  constructor(private readonly traficService: TraficService) {}

  // GET /trafic?latitude=&longitude=&rayon=
  @Get()
  async getTrafic(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('rayon') rayon?: string,
  ) {
    const trafic = await this.traficService.getTraficActuel(
      parseFloat(latitude),
      parseFloat(longitude),
      rayon ? parseFloat(rayon) : undefined,
    );
    // Format de réponse compatible frontend
    return {
      segments: [
        {
          roadName: 'Route actuelle',
          congestionLevel:
            trafic.niveau === 'bouchon'
              ? 'high'
              : trafic.niveau === 'dense'
                ? 'moderate'
                : 'low',
          averageSpeed: trafic.vitesseMoyenne,
          geometry: 'encoded_polyline_string',
        },
      ],
    };
  }

  // POST /trafic
  @Post()
  async create(@Body() dto: CreateTraficDto, @CurrentUser() user: UserProfile) {
    const relevé = await this.traficService.enregistrerRelevé({
      ...dto,
      id_utilisateur: user.uid,
    });
    return { success: true, relevé };
  }
}
