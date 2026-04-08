import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Intercepteur de Logs global
  app.useGlobalInterceptors(new LoggingInterceptor());

  // 2. Filtre d'exceptions global
  app.useGlobalFilters(new HttpExceptionFilter());

  // 3. Validation globale
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 KayyDrive is running on: http://localhost:${port}`);
}
bootstrap();
