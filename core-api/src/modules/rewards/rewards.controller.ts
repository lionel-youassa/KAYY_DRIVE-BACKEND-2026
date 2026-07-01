import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('rewards')
@UseGuards(AuthGuard)
export class RewardsController {
    // 1. On injecte le service qui contient la logique Prisma
    constructor(private readonly rewardsService: RewardsService) {}

    // 2. Route POST : Créer une récompense (admin uniquement)
    @Post()
    @UseGuards(AdminGuard)
    async createReward(@Body() data: any) {
        return await this.rewardsService.createReward(data);
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