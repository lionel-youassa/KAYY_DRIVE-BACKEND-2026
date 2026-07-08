import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NavigationModule } from './modules/navigation/navigation.module';
import { AdsModule } from './modules/ads/ads.module';
import { PrismaModule } from './prisma/prisma.module';
import { RewardsService } from './modules/rewards/rewards.service';
import { AuthModule } from './auth/auth.module';
import { IncidentsModule } from './incidents/incidents.module';
import { RoutesModule } from './routes/routes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SafeDriveModule } from './safe-drive/safe-drive.module';
import { TraficModule } from './trafic/trafic.module';
import { PredictionsModule } from './predictions/predictions.module';
import { CategoriesModule } from './categories/categories.module';
import { PreferencesModule } from './preferences/preferences.module';
import { UsersModule } from './users/users.module';
import { AdressesFavoritesModule } from './adresses-favorites/adresses-favorites.module';
import { OfflineModule } from './modules/offline/offline.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StorageModule } from './storage/storage.module';
import { GeocodingModule } from './geocoding/geocoding.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    PrismaModule,
    NavigationModule,
    AdsModule,
    AuthModule,
    IncidentsModule,
    RoutesModule,
    NotificationsModule,
    SafeDriveModule,
    TraficModule,
    PredictionsModule,
    CategoriesModule,
    PreferencesModule,
    UsersModule,
    AdressesFavoritesModule,
    OfflineModule,
    TelemetryModule,
    DashboardModule,
    StorageModule,
    GeocodingModule,
  ],
  controllers: [],
  providers: [RewardsService],
})
export class AppModule {}
