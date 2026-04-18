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
  Res,
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

const uploadStorage = diskStorage({
  destination: (req, file, cb) => {
    const dir = join(
      process.cwd(),
      "uploads",
      `project-${req.params.projectId}`,
    );
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    cb(null, dir);
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
  @UseInterceptors(FileInterceptor("file", { storage: uploadStorage }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiOperation({ summary: "Upload a document to project" })
  upload(
    @Param("projectId", ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentsService.uploadFile(projectId, file);
  }

  @Get()
  @RequirePermissions("project:read")
  @ApiOperation({ summary: "Get documents for a project" })
  findAll(@Param("projectId", ParseIntPipe) projectId: number) {
    return this.documentsService.findByProject(projectId);
  }

  @Delete(":id")
  @RequirePermissions("document:delete")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.documentsService.remove(id);
  }
}
