import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GET /notifications
  @Get()
  async getNotifications(@CurrentUser() user: DecodedIdToken) {
    const notifications = await this.notificationsService.getNotificationsUtilisateur(user.uid);
    return { notifications };
  }

  // POST /notifications/token
  @Post('token')
  async registerToken(@Body() dto: RegisterTokenDto, @CurrentUser() user: DecodedIdToken) {
    await this.notificationsService.enregistrerTokenFCM(user.uid, dto.token);
    return { success: true };
  }

  // PATCH /notifications/:id/lue
  @Patch(':id/lue')
  async marquerLue(@Param('id') id: string) {
    await this.notificationsService.marquerCommeLue(id);
    return { success: true };
  }
}
