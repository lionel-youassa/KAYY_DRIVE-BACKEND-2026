import { IsNumber, IsNotEmpty, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetRouteDto {
  @ApiProperty({ example: 3.848, description: 'Latitude de départ' })
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  startLat: number;

  @ApiProperty({ example: 11.502, description: 'Longitude de départ' })
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  startLng: number;

  @ApiProperty({ example: 3.860, description: 'Latitude de destination' })
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  endLat: number;

  @ApiProperty({ example: 11.515, description: 'Longitude de destination' })
  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  endLng: number;
}
