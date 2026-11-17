import { IsString, Matches } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Le code doit contenir exactement 6 chiffres.',
  })
  code!: string;
}
