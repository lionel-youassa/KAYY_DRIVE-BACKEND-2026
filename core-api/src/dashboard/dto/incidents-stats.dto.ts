import { ApiProperty } from '@nestjs/swagger';

export class IncidentsStatsDto {
  @ApiProperty({ description: 'Incidents par type' })
  incidentsByType: IncidentByTypeDto[];

  @ApiProperty({ description: 'Taux de confirmation global (%)' })
  confirmationRate: number;

  @ApiProperty({ description: 'Incidents confirmés' })
  confirmedIncidents: number;

  @ApiProperty({ description: 'Incidents en attente de confirmation' })
  pendingIncidents: number;

  @ApiProperty({ description: 'Incidents des 7 derniers jours par date' })
  incidentsLast7Days: DailyIncidentDto[];
}

export class IncidentByTypeDto {
  @ApiProperty({ description: "Type d'incident" })
  type: string;

  @ApiProperty({ description: "Nombre d'incidents" })
  count: number;

  @ApiProperty({ description: 'Pourcentage du total' })
  percentage: number;
}

export class DailyIncidentDto {
  @ApiProperty({ description: 'Date' })
  date: string;

  @ApiProperty({ description: "Nombre d'incidents" })
  count: number;
}
