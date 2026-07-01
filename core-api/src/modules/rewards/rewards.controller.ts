import { Controller, Post, Get, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { StorageService } from '../../storage/storage.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('rewards')
@UseGuards(AuthGuard)
export class RewardsController {
    // 1. On injecte le service qui contient la logique Prisma
    constructor(
        private readonly rewardsService: RewardsService,
        private readonly storageService: StorageService,
    ) {}

    // 2. Route POST : Créer une récompense (admin uniquement)
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

        return await this.rewardsService.createReward({ ...data, imageUrl });
    }

    // 3. Route GET : Lister toutes les récompenses
    @Get()
    async getAllRewards() {
        return await this.rewardsService.getAllRewards();
    }

    // 4. Route DELETE : Supprimer une récompense (admin uniquement)
    @Delete(':id')
    @UseGuards(AdminGuard)
    async deleteReward(@Param('id') id: string) {
        return await this.rewardsService.deleteReward(id);
    }
}