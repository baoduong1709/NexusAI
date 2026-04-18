import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ example: "admin@nexusai.com" })
  @IsEmail()
  email: string;

  @ApiProperty({ example: "Admin@123" })
  @IsString()
  @IsNotEmpty()
  password: string;
}
