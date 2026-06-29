import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { NavigationParserService } from './navigation-parser.service';
import { LocalRoutesService } from './local-routes.service';

@Module({
  imports: [HttpModule],
  controllers: [NavigationController],
  providers: [NavigationService, NavigationParserService, LocalRoutesService],
  exports: [NavigationService, NavigationParserService, LocalRoutesService],
})
export class NavigationModule {}
