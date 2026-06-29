import { IsIn } from 'class-validator';

export class VoteRouteDto {
  @IsIn(['positif', 'negatif'])
  vote!: 'positif' | 'negatif';
}
