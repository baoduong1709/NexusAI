import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Query,
  Res,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { mkdirSync, existsSync } from "fs";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { Response } from "express";
import { DocumentsService } from "./documents.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { DocumentsQueryDto } from "./dto/documents-query.dto";

const uploadStorage = diskStorage({
  destination: (req, file, cb) => {
    const folder = (req as any).body?.folder;
    const subDir = folder
      ? join(process.cwd(), "uploads", `project-${req.params.projectId}`, folder)
      : join(process.cwd(), "uploads", `project-${req.params.projectId}`);
    if (!existsSync(subDir)) mkdirSync(subDir, { recursive: true });
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${extname(file.originalname)}`);
  },
});

@ApiTags("Documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects/:projectId/documents")
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post("upload")
  @RequirePermissions("document:upload")
  @UseInterceptors(FileInterceptor("file", {
    storage: uploadStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        'text/markdown',
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`File type '${file.mimetype}' is not allowed`), false);
      }
    },
  }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        folder: { type: "string", description: "Target employee folder (e.g. employee-{userId})" },
      },
    },
  })
  @ApiOperation({ summary: "Upload a document to an employee folder in the project" })
  upload(
    @Param("projectId", ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body("folder") folder?: string,
    @CurrentUser() user?: { id: number },
  ) {
    const targetFolder = folder || `employee-${user?.id}`;
    return this.documentsService.uploadFile(projectId, file, targetFolder, user?.id);
  }

  /** List all employee folders in a project */
  @Get("folders")
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "List all employee document folders in a project" })
  getFolders(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.documentsService.getFolders(projectId);
  }

  /** List documents inside a specific folder */
  @Get("folders/:folder")
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "List paginated documents in a specific employee folder" })
  findByFolder(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("folder") folder: string,
    @Query() query: DocumentsQueryDto,
  ) {
    return this.documentsService.findByProject(projectId, {
      ...query,
      folder,
    });
  }

  @Get()
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "Get paginated documents for a project, optionally filtered by folder" })
  findAll(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Query() query: DocumentsQueryDto,
  ) {
    return this.documentsService.findByProject(projectId, query);
  }

  @Get(":id/download")
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "Download a document file directly" })
  async download(
    @Param("projectId", ParseIntPipe) projectId: number,
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const doc = await this.documentsService.findOne(id);
    if (!doc || doc.projectId !== projectId) {
      throw new NotFoundException("Document not found");
    }

    if (doc.storageProvider === "s3") {
      const url = this.documentsService.getFileUrl(
        projectId,
        doc.path,
        doc.filename,
        doc.folder,
        doc.storageProvider,
      );
      return res.redirect(url);
    }

    if (existsSync(doc.path)) {
      return res.download(doc.path, doc.originalName);
    }

    throw new NotFoundException("File not found on server");
  }

  @Delete(":id")
  @RequirePermissions("document:delete")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.documentsService.remove(id);
  }
}
