import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
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
}
