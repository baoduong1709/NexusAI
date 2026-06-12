import { IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddMemberDto {
  @ApiPropertyOptional({ description: 'Project role for the member', example: 'Developer' })
  @IsString()
  @IsOptional()
  projectRole?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ description: 'New project role', example: 'Tech Lead' })
  @IsString()
  projectRole: string;
}
