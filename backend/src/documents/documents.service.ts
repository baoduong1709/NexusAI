import { Injectable, NotFoundException } from "@nestjs/common";
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

@Injectable()
export class DocumentsService {
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

    // Start background conversion to markdown if file is convertible
    const ext = extname(file.originalname).toLowerCase();
    if (CONVERTIBLE_EXTS.has(ext)) {
      this.markitdownService
        .convertToMarkdown(file.path, `${file.path}.md`)
        .then(() => {
           // Read markdown and index it
           try {
             const mdContent = fs.readFileSync(`${file.path}.md`, "utf-8");
             this.ragService.indexDocument(projectId, document.id, mdContent, document.originalName);
           } catch(e) {}
        })
        .catch(() => {});
    }

    this.projectAiIndex.rebuildSoon(projectId);
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
