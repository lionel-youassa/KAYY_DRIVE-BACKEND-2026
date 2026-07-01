import { ApiProperty } from '@nestjs/swagger';

export class ShortcutStatsDto {
  @ApiProperty({ description: 'Nombre total de raccourcis créés' })
  totalShortcuts: number;

  @ApiProperty({ description: 'Score de fiabilité moyen' })
  averageReliabilityScore: number;

  @ApiProperty({ description: 'Taux d\'adoption estimé (%)' })
  adoptionRate: number;

  @ApiProperty({ description: 'Top 5 des raccourcis les plus votés' })
  topShortcuts: TopShortcutDto[];
}

export class TopShortcutDto {
  @ApiProperty({ description: 'ID du raccourci' })
  id: string;

  @ApiProperty({ description: 'Nom du raccourci' })
  nom: string;

  @ApiProperty({ description: 'Description' })
  description: string;

  @ApiProperty({ description: 'Score de fiabilité' })
  scoreFiabilite: number;

  @ApiProperty({ description: 'Votes positifs' })
  votesPositifs: number;

  @ApiProperty({ description: 'Votes négatifs' })
  votesNegatifs: number;

  @ApiProperty({ description: 'Nom du créateur' })
  createurNom: string;
}
