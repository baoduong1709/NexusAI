import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join, extname } from "path";
import { ConfigService } from "@nestjs/config";
import { ProjectAiIndexService } from "../project-ai-index/project-ai-index.service";
import { MarkitdownService } from "./markitdown.service";
import { RagService } from "../ai/rag.service";
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
  ) {}

  async uploadFile(projectId: number, file: Express.Multer.File) {
    const document = await this.prisma.document.create({
      data: {
        projectId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
      },
    });

    const ext = extname(file.originalname).toLowerCase();
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
           }
        })
        .catch((err) => {
          this.logger.error(`Failed to convert file to markdown: ${err.message}`);
        });
    } else if (DIRECTLY_INDEXABLE_EXTS.has(ext)) {
      this.logger.log(`Start direct indexing for text file: ${file.originalname}`);
      fs.readFile(file.path, "utf-8", async (err, content) => {
        if (err) {
          this.logger.error(`Failed to read text file: ${err.message}`);
          return;
        }
        try {
          await this.ragService.indexDocument(projectId, document.id, content, document.originalName);
          this.projectAiIndex.rebuildSoon(projectId); // Rebuild after index completes
        } catch (e: any) {
          this.logger.error(`Failed to index text file: ${e.message}`);
        }
      });
    } else {
      this.logger.log(`Binary or unsupported file uploaded: ${file.originalname}, rebuilding project index`);
      this.projectAiIndex.rebuildSoon(projectId);
    }

    return document;
  }

  findByProject(projectId: number) {
    return this.prisma.document.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async remove(id: number) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");

    if (existsSync(doc.path)) {
      unlinkSync(doc.path);
    }

    // Clean up the converted markdown file if it exists
    const mdPath = `${doc.path}.md`;
    if (existsSync(mdPath)) {
      try {
        unlinkSync(mdPath);
      } catch {}
    }

    const removed = await this.prisma.document.delete({ where: { id } });
    this.projectAiIndex.rebuildSoon(doc.projectId);
    return removed;
  }

  async getDocumentContent(
    id: number,
  ): Promise<{ path: string; originalName: string }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    return { path: doc.path, originalName: doc.originalName };
  }
}
