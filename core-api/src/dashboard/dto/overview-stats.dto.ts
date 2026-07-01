import { ApiProperty } from '@nestjs/swagger';

export class OverviewStatsDto {
  @ApiProperty({ description: "Nombre total d'utilisateurs" })
  totalUsers: number;

  @ApiProperty({ description: 'Utilisateurs actifs dans les dernières 24h' })
  activeUsers24h: number;

  @ApiProperty({
    description: 'Utilisateurs authentifiés dans les dernières 7j',
  })
  activeUsers7d: number;

  @ApiProperty({
    description: 'Utilisateurs authentifiés dans les derniers 30j',
  })
  activeUsers30d: number;

  @ApiProperty({ description: 'Sessions de navigation en cours' })
  activeSessions: number;

  @ApiProperty({ description: 'Distance totale parcourue (km)' })
  totalDistanceKm: number;

  @ApiProperty({ description: "Incidents signalés aujourd'hui" })
  incidentsToday: number;

  @ApiProperty({ description: 'Raccourcis communautaires créés' })
  totalShortcuts: number;

  @ApiProperty({ description: 'Taux de confirmation des incidents (%)' })
  incidentConfirmationRate: number;
}
