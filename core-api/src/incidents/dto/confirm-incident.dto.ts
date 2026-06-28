import { IsNumber } from 'class-validator';

export class ConfirmIncidentDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}
