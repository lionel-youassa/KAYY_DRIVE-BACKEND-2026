import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['voiture', 'moto', 'pied', 'transport_commun'])
  modeDeplacement?: 'voiture' | 'moto' | 'pied' | 'transport_commun';

  @IsOptional()
  @IsBoolean()
  notificationsIncidents?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsRaccourcis?: boolean;

  @IsOptional()
  @IsBoolean()
  eviterZonesRisque?: boolean;

  @IsOptional()
  @IsIn(['km', 'miles'])
  unite?: 'km' | 'miles';

  @IsOptional()
  @IsIn(['fr', 'en'])
  langue?: 'fr' | 'en';
}
