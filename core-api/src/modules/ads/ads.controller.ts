import { Controller, Post, Get, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AdsService } from './ads.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { StorageService } from '../../storage/storage.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('ads')
@UseGuards(AuthGuard)
export class AdsController {
    // 1. On injecte le service qui contient la logique Prisma
    constructor(
        private readonly adsService: AdsService,
        private readonly storageService: StorageService,
    ) {}

    // 2. Route POST : Créer une publicité (admin uniquement)
    @Post()
    @UseGuards(AdminGuard)
    @UseInterceptors(FileInterceptor('image'))
    async createAdvertising(
        @Body() data: any,
        @UploadedFile() image?: Express.Multer.File,
    ) {
        let imageUrl: string | undefined;
        
        if (image) {
            imageUrl = await this.storageService.uploadFile(image, 'ads');
        }

        return await this.adsService.createAdvertising({ ...data, imageUrl });
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