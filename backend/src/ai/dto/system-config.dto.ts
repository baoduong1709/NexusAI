import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateSystemConfigsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  AI_API_KEY?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  AI_API_BASE?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  AI_PRO_MODEL?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  AI_FLASH_MODEL?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  AI_SUMMARY_MODEL?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  AI_EMBEDDING_MODEL?: string;
}
