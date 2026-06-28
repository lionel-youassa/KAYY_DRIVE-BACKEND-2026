import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { FirebaseModule } from './firebase/firebase.module';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL,
      },
    }),
    FirebaseModule,
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
  ],
})
export class AppModule {}
