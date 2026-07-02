import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import IncidentsService from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { ConfirmIncidentDto } from './dto/confirm-incident.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('incidents')
@UseGuards(AuthGuard)
export class IncidentsController {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // GET /incidents?latitude=&longitude=&rayon=
  @Get()
  async getIncidents(
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('rayon') rayon?: string,
  ) {
    const incidents = await this.incidentsService.getIncidentsProches(
      parseFloat(latitude),
      parseFloat(longitude),
      rayon ? parseFloat(rayon) : undefined,
    );
    return { incidents };
  }

  // POST /incidents
  @Post()
  async createIncident(
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const incident = await this.incidentsService.createIncident({
      type: dto.type,
      description: dto.description || '',
      latitude: dto.latitude,
      longitude: dto.longitude,
      id_utilisateur_createur: user.uid,
    });

    // Notifie les utilisateurs proches sans bloquer la réponse
    const messages: Record<string, string> = {
      inondation: 'Inondation signalée près de vous',
      travaux: 'Travaux signalés près de vous',
      accident: 'Accident signalé près de vous',
    };

    this.notificationsService
      .notifierUtilisateursProches(dto.latitude, dto.longitude, 2000, {
        type: 'incident_proche',
        titre: messages[dto.type],
        corps: dto.description || 'Soyez prudent sur votre trajet.',
        data: { incidentId: incident.id || '' },
      })
      .catch((err) => console.error('Erreur notification incident:', err));

    return { success: true, incident };
  }

  // POST /incidents/:id/confirmer
  @Post(':id/confirmer')
  async confirmer(
    @Param('id') id: string,
    @Body() dto: ConfirmIncidentDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const result = await this.incidentsService.confirmerIncident(
      id,
      user.uid,
      dto.latitude,
      dto.longitude,
    );
    return { success: true, ...result };
  }
}
