import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateIncidentDto {
  @IsIn(['inondation', 'travaux', 'accident', 'bouchon', 'route_degradee', 'endomage'])
  type!: 'inondation' | 'travaux' | 'accident' | 'bouchon' | 'route_degradee' | 'endomage';

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
