import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
export declare class DocumentsService {
    private prisma;
    private config;
    constructor(prisma: PrismaService, config: ConfigService);
    uploadFile(projectId: number, file: Express.Multer.File): Promise<{
        projectId: number;
        id: number;
        createdAt: Date;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        path: string;
    }>;
    findByProject(projectId: number): import(".prisma/client").Prisma.PrismaPromise<{
        projectId: number;
        id: number;
        createdAt: Date;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        path: string;
    }[]>;
    remove(id: number): Promise<{
        projectId: number;
        id: number;
        createdAt: Date;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        path: string;
    }>;
    getDocumentContent(id: number): Promise<{
        path: string;
        originalName: string;
    }>;
}
