import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateIncidentDto {
  @IsIn(['inondation', 'travaux', 'accident'])
  type!: 'inondation' | 'travaux' | 'accident';

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
