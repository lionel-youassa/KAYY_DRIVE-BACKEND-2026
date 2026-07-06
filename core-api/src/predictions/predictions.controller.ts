import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
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

    const comfort = await this.predictionsService.calculerComfortItineraire(dto.points);

    // Format de réponse compatible frontend
    const totalDuration = predictions.reduce(
      (sum, p) => sum + (p.vitesseMoyennePredite > 0 ? 60 / p.vitesseMoyennePredite : 0),
      0,
    );
    const avgConfidence = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + (p.confidence === 'haute' ? 0.9 : p.confidence === 'moyenne' ? 0.6 : 0.3), 0) / predictions.length
      : 0.5;

    const trafficHotspots = predictions
      .filter(p => p.niveauPredit === 'bouchon' || p.niveauPredit === 'dense')
      .map(p => ({
        location: { lat: p.latitude, lon: p.longitude },
        severity: p.niveauPredit === 'bouchon' ? 'high' : 'moderate',
        expectedDelay: p.niveauPredit === 'bouchon' ? 30 : 15,
      }));

    const confidenceVal = Math.round(avgConfidence * 100) / 100;
    const avgSpeed = predictions.length > 0
      ? predictions.reduce((sum, p) => sum + p.vitesseMoyennePredite, 0) / predictions.length
      : 40;

    let niveau_trafic = 'modere';
    if (avgSpeed >= 35) niveau_trafic = 'fluide';
    else if (avgSpeed >= 20) niveau_trafic = 'modere';
    else if (avgSpeed >= 10) niveau_trafic = 'dense';
    else niveau_trafic = 'bloque';

    return {
      niveau_trafic,
      temps_estime_minutes: Math.round(totalDuration * 10) / 10,
      confiance: confidenceVal,
      predictedDuration: Math.round(totalDuration * 60),
      confidence: confidenceVal,
      trafficHotspots,
      comfortScore: comfort.comfortScore,
      comfortLevel: comfort.comfortLevel,
      recommendation: comfort.recommendation,
      hasFlood: comfort.hasFlood,
      hasDegraded: comfort.hasDegraded,
      predictions: predictions.map(p => ({
        latitude: p.latitude,
        longitude: p.longitude,
        niveauPredit: p.niveauPredit,
      })),
      confort() {

      }
    };
  }
}
