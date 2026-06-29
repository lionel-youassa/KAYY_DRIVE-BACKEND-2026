import { IsNumber, IsString } from 'class-validator';

export class CreateCategorieDto {
  @IsString()
  nom!: string;

  @IsString()
  icone!: string;

  @IsString()
  couleur!: string;

  @IsNumber()
  ordre!: number;
}
