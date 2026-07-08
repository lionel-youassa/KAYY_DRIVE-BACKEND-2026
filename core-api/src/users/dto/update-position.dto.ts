import { IsNumber } from 'class-validator';

export class UpdatePositionDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
