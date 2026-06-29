import { IsIn, IsString } from 'class-validator';

export class PromoteDto {
  @IsString()
  uid!: string;

  @IsIn(['user', 'admin'])
  role!: 'user' | 'admin';
}
