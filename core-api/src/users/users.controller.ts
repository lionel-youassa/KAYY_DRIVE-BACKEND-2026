import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdatePositionDto } from './dto/update-position.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // POST /users/position
  @Post('position')
  async updatePosition(
    @Body() dto: UpdatePositionDto,
    @CurrentUser() user: DecodedIdToken,
  ) {
    await this.usersService.mettreAJourPosition(
      user.uid,
      dto.latitude,
      dto.longitude,
    );
    return { success: true };
  }

  // DELETE /users/position
  @Delete('position')
  async deletePosition(@CurrentUser() user: DecodedIdToken) {
    await this.usersService.supprimerPosition(user.uid);
    return { success: true };
  }
}
