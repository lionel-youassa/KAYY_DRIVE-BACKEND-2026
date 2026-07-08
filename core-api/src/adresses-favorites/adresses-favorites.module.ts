import { Module } from '@nestjs/common';
import { AdressesFavoritesController } from './adresses-favorites.controller';
import { AdressesFavoritesService } from './adresses-favorites.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdressesFavoritesController],
  providers: [AdressesFavoritesService],
  exports: [AdressesFavoritesService],
})
export class AdressesFavoritesModule {}
