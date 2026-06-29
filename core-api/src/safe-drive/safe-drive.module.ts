import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SafeDriveController } from './safe-drive.controller';
import { SafeDriveService, SAFE_DRIVE_QUEUE } from './safe-drive.service';
import { SafeDriveProcessor } from './safe-drive.processor';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    BullModule.registerQueue({
      name: SAFE_DRIVE_QUEUE,
    }),
  ],
  controllers: [SafeDriveController],
  providers: [SafeDriveService, SafeDriveProcessor],
  exports: [SafeDriveService],
})
export class SafeDriveModule {}
