import { IsNumber, IsNotEmpty, Max, Min, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetRouteDto {
  @ApiProperty({ example: 4.051, description: 'Latitude de départ' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  startLat!: number;

  @ApiProperty({ example: 9.767, description: 'Longitude de départ' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  startLng!: number;

  @ApiProperty({ example: 3.848, description: 'Latitude de destination' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  endLat!: number;

  @ApiProperty({ example: 11.502, description: 'Longitude de destination' })
  @Type(() => Number)
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  endLng!: number;

  @ApiProperty({ example: 'vehicle', description: 'Mode de navigation: vehicle ou pedestrian', required: false })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiProperty({ example: 'confort', description: 'Profil de routage: confort ou rapide', required: false })
  @IsOptional()
  @IsString()
  routingMode?: 'confort' | 'rapide';
}
