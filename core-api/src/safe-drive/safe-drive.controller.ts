import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { SafeDriveService } from './safe-drive.service';
import { SecousseDto } from './dto/secousse.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('safe-drive')
@UseGuards(AuthGuard)
export class SafeDriveController {
  constructor(private readonly safeDriveService: SafeDriveService) {}

  // POST /safe-drive/secousse
  @Post('secousse')
  async secousse(@Body() dto: SecousseDto, @CurrentUser() user: DecodedIdToken) {
    await this.safeDriveService.ajouterSecousse({
      id_utilisateur: user.uid,
      latitude: dto.latitude,
      longitude: dto.longitude,
      intensite: dto.intensite,
      timestamp: new Date().toISOString(),
    });
    return { success: true, message: 'Donnée reçue et mise en file' };
  }
}
