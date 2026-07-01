import { ApiProperty } from '@nestjs/swagger';

export class UserEngagementDto {
  @ApiProperty({ description: 'Top 10 des contributeurs' })
  topContributors: TopContributorDto[];

  @ApiProperty({ description: 'Signalements par utilisateur (moyenne)' })
  averageReportsPerUser: number;

  @ApiProperty({ description: 'Votes par utilisateur (moyenne)' })
  averageVotesPerUser: number;

  @ApiProperty({ description: 'Adresses favorites créées' })
  totalFavoriteAddresses: number;

  @ApiProperty({ description: 'Utilisateurs avec adresses favorites' })
  usersWithFavorites: number;
}

export class TopContributorDto {
  @ApiProperty({ description: 'ID utilisateur' })
  id: string;

  @ApiProperty({ description: 'Pseudo' })
  pseudo: string;

  @ApiProperty({ description: 'Email' })
  email: string;

  @ApiProperty({ description: 'Score de réputation' })
  scoreReputation: number;

  @ApiProperty({ description: 'Nombre d\'incidents signalés' })
  incidentsReported: number;

  @ApiProperty({ description: 'Nombre de raccourcis créés' })
  shortcutsCreated: number;

  @ApiProperty({ description: 'Nombre de votes' })
  votesCount: number;
}
