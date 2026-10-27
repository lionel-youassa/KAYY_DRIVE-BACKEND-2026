import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AdsService, AdType } from './ads.service';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { StorageService } from '../../storage/storage.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('ads')
@UseGuards(AuthGuard)
export class AdsController {
  constructor(
    private readonly adsService: AdsService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * POST /ads — Création réservée aux administrateurs (modèle Spotify).
   * Les utilisateurs standard ne créent jamais de pub : ils la subissent
   * via GET /ads/active (bannière / interstitiel).
   */
  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('image'))
  async createAdvertising(
    @Body() data: any,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    let imageUrl: string | undefined = data?.imageUrl;

    if (image) {
      imageUrl = await this.storageService.uploadFile(image, 'ads');
    }

    const ad = await this.adsService.createAdvertising({ ...data, imageUrl });
    return {
      success: true,
      message: 'Publicité créée avec succès',
      ad,
    };
  }

  @Get()
  @UseGuards(AdminGuard)
  async getAllAdvertising(
    @Query('type') type?: string,
    @Query('actif') actif?: string,
  ) {
    const ads = await this.adsService.getAllAdvertising({
      type: type as AdType | undefined,
      actif:
        actif === undefined ? undefined : actif === 'true' || actif === '1',
    });
    return { ads };
  }

  @Get('active')
  async getActiveAds(
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const ads = await this.adsService.getActiveAds(
      (type as AdType | undefined) ?? undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { ads };
  }

  /**
   * PATCH /ads/:id — Modération / édition réservée admin.
   * Permet activer/désactiver, corriger titre/description/type/dates.
   */
  @Patch(':id')
  @UseGuards(AdminGuard)
  async updateAdvertising(@Param('id') id: string, @Body() data: any) {
    const ad = await this.adsService.updateAdvertising(id, data);
    return { success: true, message: 'Publicité mise à jour', ad };
  }

  /**
   * POST /ads/:id/view et /click — Tracking d'impressions/clics.
   * No-op persistant pour l'instant (colonnes vues/clics absentes du schéma),
   * mais contrat stable pour le frontend SmartAdManager.
   */
  @Post(':id/view')
  async recordView(@Param('id') id: string) {
    await this.adsService.recordView(id);
    return { success: true };
  }

  @Post(':id/click')
  async recordClick(@Param('id') id: string) {
    await this.adsService.recordClick(id);
    return { success: true };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteAdvertising(@Param('id') id: string) {
    await this.adsService.deleteAdvertising(id);
    return { success: true, message: 'Publicité supprimée' };
  }
}
