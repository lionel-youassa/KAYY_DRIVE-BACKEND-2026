import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { getAllowedOrigins } from './config/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  app.enableCors({
    origin: getAllowedOrigins(),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Active automatiquement la validation des DTO (class-validator) sur
  // toutes les routes. Sans ça, les décorateurs @IsString(), @IsNumber()
  // etc. dans nos DTO ne servent à rien.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // retire les champs non déclarés dans le DTO
      forbidNonWhitelisted: true,
      transform: true, // convertit automatiquement les types (ex: query string -> number)
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('KayyDrive API')
    .setDescription('Backend Core de navigation intelligente pour KayyDrive')
    .setVersion('1.0')
    .addTag('navigation')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Health check endpoint
  app.getHttpAdapter().get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(` KayyDrive Core API is running on: http://localhost:${port}`);
}
bootstrap();
