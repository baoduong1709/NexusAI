import { IsEnum, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Priority } from "@prisma/client";
import { PaginatedQueryDto } from "../../common/dto/paginated-query.dto";

export class TasksQueryDto extends PaginatedQueryDto {
  @ApiPropertyOptional({ description: "Filter by task status" })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: "Search in title, description, and ID" })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional({ description: "Filter by epic" })
  @IsString()
  @IsOptional()
  epic?: string;

  @ApiPropertyOptional({ description: "Filter by sprint" })
  @IsString()
  @IsOptional()
  sprint?: string;

  @ApiPropertyOptional({ description: "Filter by assignee user ID" })
  @Type(() => Number)
  @IsOptional()
  assigneeId?: number;

  @ApiPropertyOptional({
    type: [String],
    description: "Filter by labels (AND match)",
  })
  @IsString({ each: true })
  @IsOptional()
  labels?: string[];

  @ApiPropertyOptional({ description: "Filter tasks due on or after this date (ISO)" })
  @IsString()
  @IsOptional()
  dueFrom?: string;

  @ApiPropertyOptional({ description: "Filter tasks due on or before this date (ISO)" })
  @IsString()
  @IsOptional()
  dueTo?: string;

  @ApiPropertyOptional({ description: 'Filter by AI generation: "ai" or "manual"' })
  @IsString()
  @IsOptional()
  ai?: string;
}
