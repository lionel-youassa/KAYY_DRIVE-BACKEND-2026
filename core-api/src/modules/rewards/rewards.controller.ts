import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { StorageService } from '../../storage/storage.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('rewards')
@UseGuards(AuthGuard)
export class RewardsController {
  constructor(
    private readonly rewardsService: RewardsService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('image'))
  async createReward(
    @Body() data: any,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined;

    if (image) {
      imageUrl = await this.storageService.uploadFile(image, 'rewards');
    }

    const reward = await this.rewardsService.createReward({
      ...data,
      imageUrl,
    });
    return { success: true, message: 'Récompense créée avec succès', reward };
  }

  @Get()
  async getAllRewards() {
    return await this.rewardsService.getAllRewards();
  }

  @Get('my-eligibility')
  async getMyEligibility(@Request() req: any) {
    const userId: string = req.user?.id || req.user?.userId || req.user?.sub;
    return await this.rewardsService.getEligibility(userId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteReward(@Param('id') id: string) {
    await this.rewardsService.deleteReward(id);
    return { success: true, message: 'Récompense supprimée' };
  }
}
