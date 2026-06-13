import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { existsSync, unlinkSync } from "fs";
import { extname } from "path";
import { ConfigService } from "@nestjs/config";
import { ProjectAiIndexService } from "../project-ai-index/project-ai-index.service";
import { MarkitdownService } from "./markitdown.service";
import { RagService } from "../ai/rag.service";
import { StorageService } from "../common/storage/storage.service";
import { DocumentsQueryDto } from "./dto/documents-query.dto";
import { PaginatedResponse } from "../common/dto/paginated-response";
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

  async uploadFile(
    projectId: string,
    file: Express.Multer.File,
    folder?: string,
    uploadedById?: number,
  ) {
    const uploadResult = await this.storageService.uploadFile(
      projectId,
      file,
      folder,
    );

    const document = await this.prisma.document.create({
      data: {
        projectId,
        filename: uploadResult.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: uploadResult.path,
        folder: folder ?? null,
        uploadedById: uploadedById ?? null,
        storageProvider: uploadResult.storageProvider ?? null,
      },
    });

    const ext = extname(file.originalname).toLowerCase();

    const cleanLocalTempFile = () => {
      const isCloud = uploadResult.storageProvider === 'r2';
      if (isCloud && fs.existsSync(file.path)) {
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
        .then(async (success) => {
           if (!success) {
             this.logger.warn(`Conversion failed or was skipped for file: ${file.originalname}`);
             cleanLocalTempFile();
             return;
           }
           try {
             const mdContent = fs.readFileSync(`${file.path}.md`, "utf-8");
             await this.ragService.indexDocument(projectId, document.id, mdContent, document.originalName);
             this.projectAiIndex.rebuildSoon(projectId); // Rebuild after index completes
           } catch (e: any) {
             this.logger.error(`Failed to index converted markdown content: ${e.message}`);
           } finally {
             cleanLocalTempFile();
             // Keep the converted markdown file so that the AI agent can read it via the read_document_content tool.
             // It will be cleaned up in the remove() method when the document is deleted.
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
      url: this.getFileUrl(
        projectId,
        document.path,
        document.filename,
        document.folder,
        document.storageProvider,
      ),
    };
  }

  getFileUrl(
    projectId: string,
    path: string,
    filename: string,
    folder?: string | null,
    storageProvider?: string | null,
  ): string {
    // If stored on R2, construct R2 URL
    if (storageProvider === 'r2') {
      const publicUrl = this.config.get<string>("R2_PUBLIC_URL") || "";
      if (publicUrl) {
        return `${publicUrl}/${path}`;
      }
      const endpoint = this.config.get<string>("R2_ENDPOINT") || "";
      const bucketName = this.config.get<string>("R2_BUCKET_NAME") || "";
      return `${endpoint}/${bucketName}/${path}`;
    }
    // Default: local storage
    const backendUrl =
      this.config.get<string>("BACKEND_URL") || "http://localhost:4000";
    const folderPrefix = folder ? `${folder}/` : "";
    return `${backendUrl}/uploads/project-${projectId}/${folderPrefix}${filename}`;
  }

  async findByProject(
    projectId: string,
    query: DocumentsQueryDto = {},
  ): Promise<PaginatedResponse<any>> {
    const { skip = 0, take = 50, folder } = query;
    const where: any = { projectId };
    if (folder) where.folder = folder;

    const [docs, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    const data = docs.map((doc) => ({
      ...doc,
      url: this.getFileUrl(
        projectId,
        doc.path,
        doc.filename,
        doc.folder,
        doc.storageProvider,
      ),
    }));

    return { data, total, skip, take };
  }

  /** List all employee folders in a project with user info */
  async getFolders(projectId: string) {
    const folders = await this.prisma.document.groupBy({
      by: ["folder", "uploadedById"],
      where: {
        projectId,
        folder: { not: null },
      },
      _count: { id: true },
      orderBy: { folder: "asc" },
    });

    // Enrich with uploader user info
    const userIds = [
      ...new Set(
        folders
          .map((f) => f.uploadedById)
          .filter((id): id is number => id !== null),
      ),
    ];

    const users =
      userIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return folders.map((f) => ({
      folder: f.folder!,
      documentCount: f._count.id,
      uploadedBy: f.uploadedById ? userMap.get(f.uploadedById) ?? null : null,
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
      url: this.getFileUrl(doc.projectId, doc.path, doc.filename, doc.folder, doc.storageProvider),
    };
  }

  async findOne(id: number) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async getDocumentContent(
    id: number,
  ): Promise<{ path: string; originalName: string }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    return { path: doc.path, originalName: doc.originalName };
  }
}
