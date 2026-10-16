import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RewardsService } from './rewards.service';
// @ts-ignore
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
// @ts-ignore
import { RolesGuard } from '../auth/roles.guard';
// @ts-ignore
import { Roles } from '../auth/roles.decorator';

@Controller('rewards')
@UseGuards(JwtAuthGuard)
export class RewardsController {
    constructor(private readonly rewardsService: RewardsService) {}

    @Get()
    getCatalog() {
        return this.rewardsService.getCatalog();
    }

    @Get('points')
    getUserPoints(@Request() req: any) {
        const userId = req.user.uid || req.user.id;
        return this.rewardsService.getUserPoints(userId);
    }

    @Get('my-rewards')
    getMyRewards(@Request() req: any) {
        const userId = req.user.uid || req.user.id;
        return this.rewardsService.getMyRewards(userId);
    }

    @Post(':id/claim')
    claimReward(@Request() req: any, @Param('id') recompenseId: string) {
        const userId = req.user.uid || req.user.id;
        return this.rewardsService.claimReward(userId, recompenseId);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles('admin')
    createReward(@Body() body: any) {
        return this.rewardsService.createReward(body);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles('admin')
    deleteReward(@Param('id') id: string) {
        return this.rewardsService.deleteReward(id);
    }
}