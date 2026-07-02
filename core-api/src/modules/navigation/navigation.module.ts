import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bullmq';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { NavigationParserService } from './navigation-parser.service';
import { RoutesModule } from '../../routes/routes.module';
import { RouteRecalculationService } from './route-recalculation.service';
import { TraficModule } from '../../trafic/trafic.module';

@Module({
  imports: [
    HttpModule,
    RoutesModule,
    TraficModule,
    BullModule.registerQueue({
      name: 'route-recalculation',
    }),
  ],
  controllers: [NavigationController],
  providers: [
    NavigationService,
    NavigationParserService,
    RouteRecalculationService,
  ],
  exports: [
    NavigationService,
    NavigationParserService,
    RouteRecalculationService,
  ],
})
export class NavigationModule {}
