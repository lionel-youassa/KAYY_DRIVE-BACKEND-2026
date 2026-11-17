import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  Patch,
  UseGuards,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { StorageService } from '../storage/storage.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PromoteDto } from './dto/promote.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { ResendTwoFactorDto } from './dto/resend-two-factor.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserProfile } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly storageService: StorageService,
  ) {}

  @Post('me/photo')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('photo'))
  async uploadPhoto(
    @CurrentUser() user: UserProfile,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    const photoUrl = await this.storageService.uploadFile(file, 'profiles');
    const updatedProfile = await this.authService.updatePhoto(
      user.uid,
      photoUrl,
    );
    return { success: true, user: updatedProfile };
  }

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.createUser(dto);
    return { success: true, ...result };
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const result = await this.authService.verifyEmail(dto.email, dto.code);
    return { success: true, ...result };
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    const result = await this.authService.resendVerification(dto.email);
    return result;
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    const result = await this.authService.login(dto.email, dto.password, {
      userAgent,
      ip,
    });
    return { success: true, ...result };
  }

  @Post('verify-2fa')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyTwoFactor(
    @Body() dto: VerifyTwoFactorDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    const result = await this.authService.verifyTwoFactor(
      dto.challengeToken,
      dto.code,
      { userAgent, ip },
    );
    return { success: true, ...result };
  }

  @Post('resend-2fa')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async resendTwoFactor(@Body() dto: ResendTwoFactorDto) {
    const result = await this.authService.resendTwoFactor(dto.challengeToken);
    return result;
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    const result = await this.authService.googleLogin(dto.idToken, {
      userAgent,
      ip,
    });
    return { success: true, ...result };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent?: string,
    @Ip() ip?: string,
  ) {
    const result = await this.authService.refresh(dto.refreshToken, {
      userAgent,
      ip,
    });
    return { success: true, ...result };
  }

  @Post('logout')
  async logout(@Body() dto?: LogoutDto) {
    const result = await this.authService.logout(dto?.refreshToken);
    return result;
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.newPassword);
  }

  @Post('change-password')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async changePassword(
    @CurrentUser() user: UserProfile,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.uid,
      dto.oldPassword,
      dto.newPassword,
    );
    return { success: true, message: 'Mot de passe modifié avec succès.' };
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: UserProfile) {
    return { user };
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: UserProfile,
    @Body() updateData: UpdateProfileDto,
  ) {
    const updatedProfile = await this.authService.updateProfile(
      user.uid,
      updateData,
    );
    return {
      success: true,
      user: updatedProfile,
      requiresEmailVerification:
        Boolean(updatedProfile.pendingEmail) || !updatedProfile.emailVerified,
    };
  }

  @Post('promote')
  @UseGuards(AuthGuard, AdminGuard)
  async promote(@Body() dto: PromoteDto) {
    await this.authService.setUserRole(dto.uid, dto.role);
    return { success: true, message: `Rôle mis à jour : ${dto.role}` };
  }
}
