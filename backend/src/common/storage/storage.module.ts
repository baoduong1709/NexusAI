import { Module, Global } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: StorageService,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('STORAGE_PROVIDER') || 'local';
        if (provider.toLowerCase() === 's3') {
          return new S3StorageService(configService);
        }
        return new LocalStorageService(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
