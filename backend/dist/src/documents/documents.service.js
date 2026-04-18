"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const fs_1 = require("fs");
const config_1 = require("@nestjs/config");
let DocumentsService = class DocumentsService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async uploadFile(projectId, file) {
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
    findByProject(projectId) {
        return this.prisma.document.findMany({
            where: { projectId },
            orderBy: { createdAt: "desc" },
        });
    }
    async remove(id) {
        const doc = await this.prisma.document.findUnique({ where: { id } });
        if (!doc)
            throw new common_1.NotFoundException("Document not found");
        if ((0, fs_1.existsSync)(doc.path)) {
            (0, fs_1.unlinkSync)(doc.path);
        }
        return this.prisma.document.delete({ where: { id } });
    }
    async getDocumentContent(id) {
        const doc = await this.prisma.document.findUnique({ where: { id } });
        if (!doc)
            throw new common_1.NotFoundException("Document not found");
        return { path: doc.path, originalName: doc.originalName };
    }
};
exports.DocumentsService = DocumentsService;
exports.DocumentsService = DocumentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], DocumentsService);
//# sourceMappingURL=documents.service.js.map