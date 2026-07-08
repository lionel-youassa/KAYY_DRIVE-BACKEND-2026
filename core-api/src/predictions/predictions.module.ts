import { Module } from '@nestjs/common';
import { PredictionsController } from './predictions.controller';
import { PredictionsService } from './predictions.service';
import { WazeRouteService } from './waze-route.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [PredictionsController],
  providers: [PredictionsService, WazeRouteService],
  exports: [PredictionsService],
})
export class PredictionsModule {}
