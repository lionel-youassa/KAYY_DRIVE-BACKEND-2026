import { IsNumber } from 'class-validator';

export class PointGpsDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
