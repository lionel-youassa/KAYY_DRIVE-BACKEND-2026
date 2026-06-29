import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { NavigationParserService } from './navigation-parser.service';

@Module({
  imports: [HttpModule],
  controllers: [NavigationController],
  providers: [NavigationService, NavigationParserService],
  exports: [NavigationService, NavigationParserService],
})
export class NavigationModule {}
