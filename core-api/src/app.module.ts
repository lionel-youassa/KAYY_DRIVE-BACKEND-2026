import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NavigationModule } from './modules/navigation/navigation.module';
import { AdsModule } from './modules/ads/ads.module';
import { PrismaModule } from './prisma/prisma.module'; // <-- AJOUTE CET IMPORT
import { RewardsService } from './modules/rewards/rewards.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule, // <-- INJECTE LE MODULE PRISMA ICI (en premier de préférence)
    NavigationModule,
    AdsModule,
  ],
  controllers: [],
  providers: [RewardsService],
})
export class AppModule {}