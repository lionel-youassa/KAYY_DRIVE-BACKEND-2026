import { IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePreferencesDto {
  @ApiProperty({ description: 'Éviter les routes à péage', required: false })
  @IsOptional()
  @IsBoolean()
  eviterPeages?: boolean;

  @ApiProperty({ description: 'Prioriser les routes sécurisées', required: false })
  @IsOptional()
  @IsBoolean()
  prioriserRoutesSecu?: boolean;

  @ApiProperty({ description: 'Éviter les zones inondables', required: false })
  @IsOptional()
  @IsBoolean()
  eviterZonesInondables?: boolean;

  @ApiProperty({ description: 'Mode hors-ligne actif', required: false })
  @IsOptional()
  @IsBoolean()
  modeHorsLigneActif?: boolean;
}
