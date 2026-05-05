import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  IsArray,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Priority } from "@prisma/client";

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsInt()
  @IsOptional()
  assigneeId?: number;

  @ApiPropertyOptional({ enum: Priority })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isAiGenerated?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sprint?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  epic?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  labels?: string[];

  @ApiPropertyOptional({ minimum: 0, description: "Estimated effort in hours" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  estimateHours?: number;

  @ApiPropertyOptional({ minimum: 0, description: "Logged effort in hours" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  loggedHours?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  status?: string;
}

export class UpdateTaskStatusDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;
}

export class CreateTaskCommentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;
}

export class CreateTaskWorkLogDto {
  @ApiProperty({ minimum: 0, description: "Logged effort in hours" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  durationHours: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}
