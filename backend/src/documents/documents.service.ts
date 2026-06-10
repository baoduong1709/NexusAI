import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { existsSync, unlinkSync } from "fs";
import { extname } from "path";
import { ConfigService } from "@nestjs/config";
import { ProjectAiIndexService } from "../project-ai-index/project-ai-index.service";
import { MarkitdownService } from "./markitdown.service";
import { RagService } from "../ai/rag.service";
import { StorageService } from "../common/storage/storage.service";
import * as fs from "fs";

const CONVERTIBLE_EXTS = new Set([
  ".pdf",
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
  ".html",
  ".htm",
]);

const DIRECTLY_INDEXABLE_EXTS = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
]);

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private projectAiIndex: ProjectAiIndexService,
    private markitdownService: MarkitdownService,
    private ragService: RagService,
    private storageService: StorageService,
  ) {}

  async uploadFile(projectId: number, file: Express.Multer.File) {
    const uploadResult = await this.storageService.uploadFile(projectId, file);

    const document = await this.prisma.document.create({
      data: {
        projectId,
        filename: uploadResult.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: uploadResult.path,
      },
    });

    const ext = extname(file.originalname).toLowerCase();

    const cleanLocalTempFile = () => {
      const provider = this.config.get<string>("STORAGE_PROVIDER") || "local";
      if (provider.toLowerCase() === "s3" && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
          this.logger.log(`Cleaned up temp local file: ${file.path}`);
        } catch (e: any) {
          this.logger.error(`Failed to delete temp local file: ${e.message}`);
        }
      }
    };

    if (CONVERTIBLE_EXTS.has(ext)) {
      this.logger.log(`Start background conversion and indexing for convertible file: ${file.originalname}`);
      this.markitdownService
        .convertToMarkdown(file.path, `${file.path}.md`)
        .then(async () => {
           try {
             const mdContent = fs.readFileSync(`${file.path}.md`, "utf-8");
             await this.ragService.indexDocument(projectId, document.id, mdContent, document.originalName);
             this.projectAiIndex.rebuildSoon(projectId); // Rebuild after index completes
           } catch (e: any) {
             this.logger.error(`Failed to index converted markdown content: ${e.message}`);
           } finally {
             cleanLocalTempFile();
             try {
               if (fs.existsSync(`${file.path}.md`)) {
                 fs.unlinkSync(`${file.path}.md`);
               }
             } catch {}
           }
        })
        .catch((err) => {
          this.logger.error(`Failed to convert file to markdown: ${err.message}`);
          cleanLocalTempFile();
        });
    } else if (DIRECTLY_INDEXABLE_EXTS.has(ext)) {
      this.logger.log(`Start direct indexing for text file: ${file.originalname}`);
      fs.readFile(file.path, "utf-8", async (err, content) => {
        try {
          if (err) {
            this.logger.error(`Failed to read text file: ${err.message}`);
            return;
          }
          await this.ragService.indexDocument(projectId, document.id, content, document.originalName);
          this.projectAiIndex.rebuildSoon(projectId); // Rebuild after index completes
        } catch (e: any) {
          this.logger.error(`Failed to index text file: ${e.message}`);
        } finally {
          cleanLocalTempFile();
        }
      });
    } else {
      this.logger.log(`Binary or unsupported file uploaded: ${file.originalname}, rebuilding project index`);
      cleanLocalTempFile();
      this.projectAiIndex.rebuildSoon(projectId);
    }

    return {
      ...document,
      url: this.getFileUrl(projectId, document.path, document.filename),
    };
  }

  private getFileUrl(projectId: number, path: string, filename: string): string {
    const provider = this.config.get<string>("STORAGE_PROVIDER") || "local";
    if (provider.toLowerCase() === "s3") {
      const publicUrl = this.config.get<string>("S3_PUBLIC_URL") || "";
      if (publicUrl) {
        return `${publicUrl}/${path}`;
      }
      const bucketName = this.config.get<string>("S3_BUCKET_NAME") || "";
      return `https://${bucketName}.s3.amazonaws.com/${path}`;
    } else {
      const backendUrl = this.config.get<string>("BACKEND_URL") || "http://localhost:4000";
      return `${backendUrl}/uploads/project-${projectId}/${filename}`;
    }
  }

  async findByProject(projectId: number) {
    const docs = await this.prisma.document.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    return docs.map((doc) => ({
      ...doc,
      url: this.getFileUrl(projectId, doc.path, doc.filename),
    }));
  }

  async remove(id: number) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");

    await this.storageService.deleteFile(doc.projectId, doc.path);

    // Clean up the converted markdown file if it exists locally
    const mdPath = `${doc.path}.md`;
    if (existsSync(mdPath)) {
      try {
        unlinkSync(mdPath);
      } catch {}
    }

    const removed = await this.prisma.document.delete({ where: { id } });
    this.projectAiIndex.rebuildSoon(doc.projectId);
    return {
      ...removed,
      url: this.getFileUrl(doc.projectId, doc.path, doc.filename),
    };
  }

  async getDocumentContent(
    id: number,
  ): Promise<{ path: string; originalName: string }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    return { path: doc.path, originalName: doc.originalName };
  }
}
