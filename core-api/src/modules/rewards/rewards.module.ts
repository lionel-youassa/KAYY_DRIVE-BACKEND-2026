import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';
import { StorageModule } from '../../storage/storage.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
