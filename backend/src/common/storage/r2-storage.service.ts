import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';

@Injectable()
export class R2StorageService extends StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private r2Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    super();
    
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('R2_REGION') || 'auto';
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || '';

    this.r2Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      endpoint: endpoint || undefined,
      forcePathStyle: true, // Cloudflare R2 works best with path style requests for custom endpoints
    });
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
    const folderPrefix = folder ? `${folder}/` : '';
    const fileKey = `uploads/project-${projectId}/${folderPrefix}${file.filename}`;
    const fileStream = fs.createReadStream(file.path);

    this.logger.log(`Uploading file to R2: ${fileKey}`);

    await this.r2Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: fileStream,
        ContentType: file.mimetype,
      }),
    );

    // Construct URL
    let url = '';
    if (this.publicUrl) {
      url = `${this.publicUrl}/${fileKey}`;
    } else {
      const endpoint = this.configService.get<string>('R2_ENDPOINT') || '';
      url = `${endpoint}/${this.bucketName}/${fileKey}`;
    }

    return {
      path: fileKey,
      filename: file.filename,
      url,
      storageProvider: 'r2',
    };
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    this.logger.log(`Deleting file from R2: ${path}`);
    try {
      await this.r2Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: path,
        }),
      );
    } catch (e: any) {
      this.logger.error(`Failed to delete file from R2: ${e.message}`);
    }
  }
}
