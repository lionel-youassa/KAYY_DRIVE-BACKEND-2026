import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('ads')
@UseGuards(AuthGuard)
export class AdsController {
    // 1. On injecte le service qui contient la logique Prisma
    constructor(private readonly adsService: AdsService) {}

    // 2. Route POST : Créer une publicité (admin uniquement)
    @Post()
    @UseGuards(AdminGuard)
    async createAdvertising(@Body() data: any) {
        return await this.adsService.createAdvertising(data);
    }

    // 3. Route GET : Lister toutes les publicités
    @Get()
    async getAllAdvertising() {
        return await this.adsService.getAllAdvertising();
    }

    // 4. Route DELETE : Supprimer une publicité (admin uniquement)
    @Delete(':id')
    @UseGuards(AdminGuard)
    async deleteAdvertising(@Param('id') id: string) {
        return await this.adsService.deleteAdvertising(id);
    }
}