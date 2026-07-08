import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PromoteDto } from './dto/promote.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserProfile } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
