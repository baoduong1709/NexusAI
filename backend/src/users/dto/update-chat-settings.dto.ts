import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsIn } from "class-validator";

export class UpdateChatSettingsDto {
  @ApiPropertyOptional({ enum: ["vi", "en"] })
  @IsString()
  @IsIn(["vi", "en"])
  @IsOptional()
  chatLanguage?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  chatDescription?: string;
}
