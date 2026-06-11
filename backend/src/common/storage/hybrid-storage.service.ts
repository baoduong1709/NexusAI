import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';

const IMAGE_MIME_PREFIX = 'image/';

@Injectable()
export class HybridStorageService extends StorageService {
  private readonly logger = new Logger(HybridStorageService.name);

  constructor(
    private readonly local: LocalStorageService,
    private readonly s3: S3StorageService,
  ) {
    super();
  }

  async uploadFile(
    projectId: number,
    file: Express.Multer.File,
    folder?: string,
  ): Promise<{
    path: string;
    filename: string;
    url: string;
    storageProvider: 'local' | 's3';
  }> {
    const isImage = file.mimetype.startsWith(IMAGE_MIME_PREFIX);

    if (isImage) {
      this.logger.log(
        `Routing image file "${file.originalname}" (${file.mimetype}) → S3`,
      );
      const result = await this.s3.uploadFile(projectId, file, folder);
      return { ...result, storageProvider: 's3' };
    }

    this.logger.log(
      `Routing document file "${file.originalname}" (${file.mimetype}) → Local`,
    );
    const result = await this.local.uploadFile(projectId, file, folder);
    return { ...result, storageProvider: 'local' };
  }

  async deleteFile(projectId: number, path: string): Promise<void> {
    // Try both providers — the one that owns the file will succeed
    try {
      await this.local.deleteFile(projectId, path);
    } catch (e: any) {
      this.logger.debug(`Local delete skipped: ${e.message}`);
    }
    try {
      await this.s3.deleteFile(projectId, path);
    } catch (e: any) {
      this.logger.debug(`S3 delete skipped: ${e.message}`);
    }
  }
}
