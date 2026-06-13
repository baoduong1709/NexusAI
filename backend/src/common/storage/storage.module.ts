import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { R2StorageService } from './r2-storage.service';
import { HybridStorageService } from './hybrid-storage.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageService,
    R2StorageService,
    {
      provide: StorageService,
      useFactory: (
        local: LocalStorageService,
        r2: R2StorageService,
      ) => {
        return new HybridStorageService(local, r2);
      },
      inject: [LocalStorageService, R2StorageService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
