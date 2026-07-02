import { IsNumber, IsNotEmpty, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RerouteDto {
  @ApiProperty({ example: 3.848, description: 'Latitude actuelle de l\'utilisateur' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  currentLat: number;

  @ApiProperty({ example: 11.502, description: 'Longitude actuelle de l\'utilisateur' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  currentLng: number;

  @ApiProperty({ example: 3.850, description: 'Latitude de destination' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  endLat: number;

  @ApiProperty({ example: 11.510, description: 'Longitude de destination' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  endLng: number;
}
