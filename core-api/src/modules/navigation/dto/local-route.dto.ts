import { ApiProperty } from '@nestjs/swagger';

export class CoordinateDto {
  @ApiProperty({ example: 3.848 })
  latitude: number;

  @ApiProperty({ example: 11.502 })
  longitude: number;
}

export class LocalRouteDto {
  @ApiProperty({ example: 'tsor-douala-yaounde-shortcut' })
  id: string;

  @ApiProperty({ example: 'Raccourci N3 - Forêt' })
  name: string;

  @ApiProperty({ example: 'shortcut', enum: ['shortcut', 'detour', 'alternative'] })
  type: 'shortcut' | 'detour' | 'alternative';

  @ApiProperty({ example: 'dry_season_only', enum: ['dry_season_only', 'all_weather', 'avoid_night'] })
  condition: 'dry_season_only' | 'all_weather' | 'avoid_night';

  @ApiProperty({ example: 8 })
  priority: number;

  @ApiProperty({ type: [CoordinateDto] })
  coordinates: CoordinateDto[];
}
