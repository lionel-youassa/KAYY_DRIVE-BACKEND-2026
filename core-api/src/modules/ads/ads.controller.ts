import { Controller, Post, Get, Delete, Body, Param } from '@nestjs/common';
import { AdsService } from './ads.service';

@Controller('ads')
export class AdsController {
    // 1. On injecte le service qui contient la logique Prisma
    constructor(private readonly adsService: AdsService) {}

    // 2. Route POST : Créer une publicité depuis Flutter
    @Post()
    async createAdvertising(@Body() data: any) {
        return await this.adsService.createAdvertising(data);
    }

    // 3. Route GET : Lister toutes les publicités
    @Get()
    async getAllAdvertising() {
        return await this.adsService.getAllAdvertising();
    }

    // 4. Route DELETE : Supprimer une publicité via son ID reçu de Flutter
    @Delete(':id')
    async deleteAdvertising(@Param('id') id: string) {
        return await this.adsService.deleteAdvertising(id); // Assure-toi que cette méthode existe dans ton ads.service.ts
    }
}