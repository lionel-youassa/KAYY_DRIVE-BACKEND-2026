import { Module } from '@nestjs/common';
import { AdressesFavoritesController } from './adresses-favorites.controller';
import { AdressesFavoritesService } from './adresses-favorites.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AdressesFavoritesController],
  providers: [AdressesFavoritesService],
  exports: [AdressesFavoritesService],
})
export class AdressesFavoritesModule {}
