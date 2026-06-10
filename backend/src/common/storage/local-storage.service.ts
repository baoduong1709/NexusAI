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
  ): Promise<{ path: string; filename: string; url: string }> {
    const backendUrl = this.configService.get<string>('BACKEND_URL') || 'http://localhost:4000';
    const url = `${backendUrl}/uploads/project-${projectId}/${file.filename}`;
    return {
      path: file.path,
      filename: file.filename,
      url,
    };
  }

  async deleteFile(projectId: number, path: string): Promise<void> {
    if (fs.existsSync(path)) {
      fs.unlinkSync(path);
    }
  }
}
