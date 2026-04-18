import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async uploadFile(projectId: number, file: Express.Multer.File) {
    return this.prisma.document.create({
      data: {
        projectId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: file.path,
      },
    });
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

    return this.prisma.document.delete({ where: { id } });
  }

  async getDocumentContent(
    id: number,
  ): Promise<{ path: string; originalName: string }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException("Document not found");
    return { path: doc.path, originalName: doc.originalName };
  }
}
