import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { LocalStorageService } from './local-storage.service';
import { R2StorageService } from './r2-storage.service';

const IMAGE_MIME_PREFIX = 'image/';

@Injectable()
export class HybridStorageService extends StorageService {
  private readonly logger = new Logger(HybridStorageService.name);

  constructor(
    private readonly local: LocalStorageService,
    private readonly r2: R2StorageService,
  ) {
    super();
  }

  async uploadFile(
    projectId: string,
    file: Express.Multer.File,
    folder?: string,
  ): Promise<{
    path: string;
    filename: string;
    url: string;
    storageProvider: 'local' | 'r2';
  }> {
    const isImage = file.mimetype.startsWith(IMAGE_MIME_PREFIX);

    if (isImage) {
      this.logger.log(
        `Routing image file "${file.originalname}" (${file.mimetype}) → R2`,
      );
      const result = await this.r2.uploadFile(projectId, file, folder);
      return { ...result, storageProvider: 'r2' };
    }

    this.logger.log(
      `Routing document file "${file.originalname}" (${file.mimetype}) → Local`,
    );
    const result = await this.local.uploadFile(projectId, file, folder);
    return { ...result, storageProvider: 'local' };
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    // Try both providers — the one that owns the file will succeed
    try {
      await this.local.deleteFile(projectId, path);
    } catch (e: any) {
      this.logger.debug(`Local delete skipped: ${e.message}`);
    }
    try {
      await this.r2.deleteFile(projectId, path);
    } catch (e: any) {
      this.logger.debug(`R2 delete skipped: ${e.message}`);
    }
  }
}
