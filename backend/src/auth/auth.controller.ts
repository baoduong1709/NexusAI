import { Controller, Post, Body, Get, UseGuards, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { CurrentUser } from "./decorators/current-user.decorator";
import { Response } from "express";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Login" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    
    // Set JWT token in an HttpOnly cookie
    response.cookie("nexusai_token", result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    // Exclude access_token from body to prevent client script from accessing it
    return {
      user: result.user,
    };
  }

  @Post("logout")
  @ApiOperation({ summary: "Logout" })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie("nexusai_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return { success: true };
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id);
  }

  @Post("personal-token")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Generate a personal access token for MCP / external tools with custom expiration" })
  generatePersonalToken(
    @CurrentUser() user: any,
    @Body() body: { expiresIn?: string },
  ) {
    const expiresIn = body.expiresIn || "365d";
    return this.authService.generatePersonalToken(user.id, expiresIn);
  }
}
