import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PointGpsDto } from './point-gps.dto';

export class CreateRouteDto {
  @IsString()
  nom!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => PointGpsDto)
  pointDepart!: PointGpsDto;

  @ValidateNested()
  @Type(() => PointGpsDto)
  pointArrivee!: PointGpsDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointGpsDto)
  trace!: PointGpsDto[];
}
