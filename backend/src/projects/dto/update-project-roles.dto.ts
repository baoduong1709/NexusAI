import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsString,
  ValidateNested,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ProjectRoleConfigDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class UpdateProjectRolesDto {
  @ApiProperty({ type: [ProjectRoleConfigDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectRoleConfigDto)
  roles: ProjectRoleConfigDto[];
}
