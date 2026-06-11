import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class StorageService {
  abstract uploadFile(
    projectId: number,
    file: Express.Multer.File,
    folder?: string,
  ): Promise<{
    path: string;
    filename: string;
    url: string;
    storageProvider: 'local' | 's3';
  }>;

  abstract deleteFile(projectId: number, path: string): Promise<void>;
}
