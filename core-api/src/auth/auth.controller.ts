import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { PromoteDto } from './dto/promote.dto';
import { AuthGuard } from './guards/auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const profile = await this.authService.createUser(dto);
    return { success: true, user: profile };
  }

  // GET /auth/me
  @Get('me')
  @UseGuards(AuthGuard)
  async me(@CurrentUser() user: DecodedIdToken) {
    const profile = await this.authService.getUserProfile(user.uid);
    return { user: profile };
  }

  // POST /auth/promote (admin uniquement)
  @Post('promote')
  @UseGuards(AuthGuard, AdminGuard)
  async promote(@Body() dto: PromoteDto) {
    await this.authService.setUserRole(dto.uid, dto.role);
    return { success: true, message: `Rôle mis à jour : ${dto.role}` };
  }
}
