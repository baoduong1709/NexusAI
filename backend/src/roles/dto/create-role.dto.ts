import { IsArray, IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateRoleDto {
  @ApiProperty({ example: "Developer" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ["project:read", "task:read", "task:update"],
    type: [String],
  })
  @IsArray()
  permissions: string[];
}
