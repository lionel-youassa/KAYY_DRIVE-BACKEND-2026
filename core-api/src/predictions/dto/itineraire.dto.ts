import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PointGpsDto } from '../../routes/dto/point-gps.dto';

export class ItineraireDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PointGpsDto)
  points!: PointGpsDto[];

  @IsOptional()
  @IsString()
  horodatage?: string;
}
