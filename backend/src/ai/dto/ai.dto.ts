import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

class ConfirmTaskDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  priority?: "LOW" | "MEDIUM" | "HIGH";

  @ApiPropertyOptional()
  @IsOptional()
  assigneeId?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  dueDate?: string;

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

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  estimateHours?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @IsOptional()
  loggedHours?: number;
}

export class ConfirmAiTasksDto {
  @ApiProperty({ type: [ConfirmTaskDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmTaskDto)
  tasks: ConfirmTaskDto[];
}

export class SuggestAssigneeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  taskDescription: string;
}

export class ImproveDescriptionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;
}

export class AssistDescriptionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  instruction: string;
}

class ChatMessageDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsString()
  @IsNotEmpty()
  role: "user" | "assistant";

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class AiChatDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  summary?: string;
}

export class AiSummarizeDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  currentSummary?: string;

  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];
}

export class CreateSessionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;
}

export class UpdateSessionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  messages?: any[];
}
