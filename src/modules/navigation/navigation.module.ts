import { Module } from '@nestjs/common';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';

@Module({
  controllers: [NavigationController],
  providers: [NavigationService],
  exports: [NavigationService], // Pour que d'autres modules puissent l'utiliser plus tard
})
export class NavigationModule {}
