import { ApiProperty } from '@nestjs/swagger';

export class SystemPerformanceDto {
  @ApiProperty({ description: 'Temps de réponse moyen des itinéraires (ms)' })
  averageRouteResponseTime: number;

  @ApiProperty({ description: 'Taux de succès OSRM (%)' })
  osrmSuccessRate: number;

  @ApiProperty({ description: 'Nombre total de requêtes de routage' })
  totalRouteRequests: number;

  @ApiProperty({ description: 'Utilisation des prédictions trafic (%)' })
  trafficPredictionUsage: number;

  @ApiProperty({ description: 'Notifications envoyées (24h)' })
  notificationsSent24h: number;

  @ApiProperty({ description: 'Notifications FCM actives' })
  activeFcmTokens: number;
}
