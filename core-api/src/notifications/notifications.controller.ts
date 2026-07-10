import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserProfile } from '../auth/auth.service';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // GET /notifications
  @Get()
  async getNotifications(@CurrentUser() user: UserProfile) {
    const notifications =
      await this.notificationsService.getNotificationsUtilisateur(user.uid);
    return { notifications };
  }

  // PATCH /notifications/:id/lue
  @Patch(':id/lue')
  async marquerLue(@Param('id') id: string) {
    await this.notificationsService.marquerCommeLue(id);
    return { success: true };
  }

  // POST /notifications/:id/lue (alias pour compatibilité frontend)
  @Post(':id/lue')
  async marquerLuePost(@Param('id') id: string) {
    await this.notificationsService.marquerCommeLue(id);
    return { success: true };
  }
}
