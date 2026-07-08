import { Module } from '@nestjs/common';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
