import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class StorageService {
  abstract uploadFile(
    projectId: number,
    file: Express.Multer.File,
  ): Promise<{ path: string; filename: string; url: string }>;

  abstract deleteFile(projectId: number, path: string): Promise<void>;
}
