import { Injectable } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';

@Injectable()
export class LocalStorageService extends StorageService {
  constructor(private configService: ConfigService) {
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
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    const folderPrefix = folder ? `${folder}/` : '';
    const url = `${backendUrl}/uploads/project-${projectId}/${folderPrefix}${file.filename}`;
    return {
      path: file.path,
      filename: file.filename,
      url,
      storageProvider: 'local',
    };
  }

  async deleteFile(projectId: number, path: string): Promise<void> {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  }
}
