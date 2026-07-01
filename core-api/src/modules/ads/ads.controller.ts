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
    let imageUrl: string | undefined;

    if (image) {
      imageUrl = await this.storageService.uploadFile(image, 'ads');
    }

    return await this.adsService.createAdvertising({ ...data, imageUrl });
  }

  @Get()
  async getAllAdvertising() {
    return await this.adsService.getAllAdvertising();
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteAdvertising(@Param('id') id: string) {
    return await this.adsService.deleteAdvertising(id);
  }
}
