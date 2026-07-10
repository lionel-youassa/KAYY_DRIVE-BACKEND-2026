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
} from '@nestjs/common';
import { AdsService } from './ads.service';
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

  @Post()
  @UseGuards(AdminGuard)
  @UseInterceptors(FileInterceptor('image'))
  async createAdvertising(
    @Body() data: any,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    console.log('DEBUG CREATE AD - Body data:', data);
    console.log('DEBUG CREATE AD - Uploaded file:', image);

    let imageUrl: string | undefined;

    if (image) {
      imageUrl = await this.storageService.uploadFile(image, 'ads');
      console.log(
        'DEBUG CREATE AD - Image uploaded to storage, URL:',
        imageUrl,
      );
    }

    const ad = await this.adsService.createAdvertising({ ...data, imageUrl });
    return { success: true, message: 'Publicité créée avec succès', ad };
  }

  @Get()
  async getAllAdvertising() {
    const ads = await this.adsService.getAllAdvertising();
    return { ads };
  }

  @Get('active')
  async getActiveAds() {
    const ads = await this.adsService.getActiveAds();
    return { ads };
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteAdvertising(@Param('id') id: string) {
    await this.adsService.deleteAdvertising(id);
    return { success: true, message: 'Publicité supprimée' };
  }
}
