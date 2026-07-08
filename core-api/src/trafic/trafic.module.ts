import { Module } from '@nestjs/common';
import { TraficController } from './trafic.controller';
import { TraficService } from './trafic.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [TraficController],
  providers: [TraficService],
  exports: [TraficService],
})
export class TraficModule {}
