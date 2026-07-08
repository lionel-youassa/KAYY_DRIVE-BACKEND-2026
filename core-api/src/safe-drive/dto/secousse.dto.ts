import { IsNumber } from 'class-validator';

export class SecousseDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsNumber()
  intensite!: number;
}
