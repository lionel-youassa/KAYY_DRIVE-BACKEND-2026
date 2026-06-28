import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { ItineraireDto } from './dto/itineraire.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('predictions')
@UseGuards(AuthGuard)
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  // GET /predictions?latitude=&longitude=&horodatage=
  @Get()
  async predictionPoint(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('horodatage') horodatage?: string,
  ) {
    const dateCible = horodatage ? new Date(horodatage) : new Date();
    if (isNaN(dateCible.getTime())) {
      throw new BadRequestException('horodatage invalide');
    }

    const prediction = await this.predictionsService.predireTraficPoint(
      parseFloat(latitude),
      parseFloat(longitude),
      dateCible,
    );
    return { prediction };
  }

  // POST /predictions/itineraire
  @Post('itineraire')
  async predictionItineraire(@Body() dto: ItineraireDto) {
    const dateCible = dto.horodatage ? new Date(dto.horodatage) : new Date();
    if (isNaN(dateCible.getTime())) {
      throw new BadRequestException('horodatage invalide');
    }

    const predictions = await this.predictionsService.predireTraficItineraire(
      dto.points,
      dateCible,
    );
    return { predictions };
  }
}
