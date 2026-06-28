import { IsNumber } from 'class-validator';

export class CreateTraficDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsNumber()
  vitesseMoyenne!: number;
}
