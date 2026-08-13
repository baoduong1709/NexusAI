import { IsEnum, IsNotEmpty, IsString, IsDateString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { LeaveType } from "@prisma/client";

export class CreateLeaveRequestDto {
  @ApiProperty({ enum: LeaveType })
  @IsEnum(LeaveType)
  type: LeaveType;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
