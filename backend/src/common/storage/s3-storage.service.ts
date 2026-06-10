import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';

@Injectable()
export class S3StorageService extends StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    super();
    
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    
    this.bucketName = this.configService.get<string>('S3_BUCKET_NAME') || '';
    this.publicUrl = this.configService.get<string>('S3_PUBLIC_URL') || '';

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      endpoint: endpoint || undefined,
      forcePathStyle: endpoint ? true : false,
    });
  }

  async uploadFile(
    projectId: number,
    file: Express.Multer.File,
  ): Promise<{ path: string; filename: string; url: string }> {
    const fileKey = `uploads/project-${projectId}/${file.filename}`;
    const fileStream = fs.createReadStream(file.path);

    this.logger.log(`Uploading file to S3: ${fileKey}`);

    await this.s3Client.send(
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
      url = `https://${this.bucketName}.s3.amazonaws.com/${fileKey}`;
    }

    return {
      path: fileKey,
      filename: file.filename,
      url,
    };
  }

  async deleteFile(projectId: number, path: string): Promise<void> {
    this.logger.log(`Deleting file from S3: ${path}`);
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: path,
        }),
      );
    } catch (e: any) {
      this.logger.error(`Failed to delete file from S3: ${e.message}`);
    }
  }
}
