import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NavigationModule } from './modules/navigation/navigation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    NavigationModule, // On injecte notre module métier ici !
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
