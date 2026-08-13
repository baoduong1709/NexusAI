import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum ReviewAction {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export class ReviewLeaveRequestDto {
  @ApiProperty({ enum: ReviewAction })
  @IsEnum(ReviewAction)
  status: ReviewAction;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reviewerNote?: string;
}
