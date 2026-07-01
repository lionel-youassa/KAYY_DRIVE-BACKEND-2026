import { ApiProperty } from '@nestjs/swagger';

export class SafeDriveStatsDto {
  @ApiProperty({ description: 'Score de qualité moyen des segments' })
  averageQualityScore: number;

  @ApiProperty({ description: 'Routes inondées actives' })
  floodedRoutesCount: number;

  @ApiProperty({ description: 'Routes dégradées actives' })
  degradedRoutesCount: number;

  @ApiProperty({ description: 'Vitesse moyenne par type de route' })
  averageSpeedByRouteType: SpeedByRouteTypeDto[];

  @ApiProperty({ description: 'Distribution des niveaux de risque' })
  riskLevelDistribution: RiskLevelDistributionDto[];
}

export class SpeedByRouteTypeDto {
  @ApiProperty({ description: 'Type de route (officiel/local)' })
  routeType: string;

  @ApiProperty({ description: 'Vitesse moyenne (km/h)' })
  averageSpeed: number;

  @ApiProperty({ description: 'Nombre de segments' })
  segmentCount: number;
}

export class RiskLevelDistributionDto {
  @ApiProperty({ description: 'Niveau de risque' })
  riskLevel: string;

  @ApiProperty({ description: "Nombre d'itinéraires" })
  count: number;

  @ApiProperty({ description: 'Pourcentage' })
  percentage: number;
}
