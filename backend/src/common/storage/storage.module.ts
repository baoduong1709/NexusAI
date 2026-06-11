import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';
import { HybridStorageService } from './hybrid-storage.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageService,
    S3StorageService,
    {
      provide: StorageService,
      useFactory: (
        local: LocalStorageService,
        s3: S3StorageService,
      ) => {
        return new HybridStorageService(local, s3);
      },
      inject: [LocalStorageService, S3StorageService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
