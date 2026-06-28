import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Active automatiquement la validation des DTO (class-validator) sur
  // toutes les routes. Sans ça, les décorateurs @IsString(), @IsNumber()
  // etc. dans nos DTO ne servent à rien.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // retire les champs non déclarés dans le DTO
      transform: true, // convertit automatiquement les types (ex: query string -> number)
    }),
  );

  app.enableCors(); // à restreindre à votre domaine frontend en production

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
