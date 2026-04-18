import { DocumentsService } from "./documents.service";
export declare class DocumentsController {
    private readonly documentsService;
    constructor(documentsService: DocumentsService);
    upload(projectId: number, file: Express.Multer.File): Promise<{
        projectId: number;
        id: number;
        createdAt: Date;
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
        path: string;
    }>;
    findAll(projectId: number): import(".prisma/client").Prisma.PrismaPromise<{
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
}
