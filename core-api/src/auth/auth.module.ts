import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { EmailModule } from '../email/email.module';
import { getJwtSecret } from './jwt-secret';

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    EmailModule,
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    AuthGuard,
    AdminGuard,
    JwtStrategy,
    LocalStrategy,
  ],
  exports: [AuthService, GoogleAuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
