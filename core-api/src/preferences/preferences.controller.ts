import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('preferences')
@UseGuards(AuthGuard)
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  // GET /preferences
  @Get()
  async getPreferences(@CurrentUser() user: DecodedIdToken) {
    const preferences = await this.preferencesService.getPreferences(user.uid);
    return { preferences };
  }

  // PATCH /preferences
  @Patch()
  async update(
    @Body() dto: UpdatePreferencesDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const preferences = await this.preferencesService.updatePreferences(
      user.uid,
      dto,
    );
    return { success: true, preferences };
  }
}
