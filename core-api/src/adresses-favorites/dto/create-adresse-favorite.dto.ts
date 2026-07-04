import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAdresseFavoriteDto {
  @IsString()
  nom!: string;

  @IsString()
  adresse!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  categorieId?: string;
}
