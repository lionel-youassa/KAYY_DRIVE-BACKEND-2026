import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  NotFoundException,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from '../storage/storage.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PromoteDto } from './dto/promote.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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

  // POST /auth/me/photo
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

  // POST /auth/register
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const profile = await this.authService.createUser(dto);
    return { success: true, user: profile };
  }

  // POST /auth/forgot-password
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email requis');
    }
    const exists = await this.authService.checkUserExists(email);
    if (!exists) {
      throw new NotFoundException('Utilisateur introuvable avec cet e-mail');
    }
    return {
      success: true,
      message: 'Un e-mail de réinitialisation de mot de passe a été envoyé.',
    };
  }

  // POST /auth/login
  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.authService.login(body.email, body.password);
    return { success: true, ...result };
  }

  // POST /auth/change-password
  @Post('change-password')
  @UseGuards(AuthGuard)
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

  // GET /auth/me
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: UserProfile) {
    return { user };
  }

  // PATCH /auth/me
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
    return { success: true, user: updatedProfile };
  }

  // POST /auth/promote (admin uniquement)
  @Post('promote')
  @UseGuards(AuthGuard, AdminGuard)
  async promote(@Body() dto: PromoteDto) {
    await this.authService.setUserRole(dto.uid, dto.role);
    return { success: true, message: `Rôle mis à jour : ${dto.role}` };
  }
}
