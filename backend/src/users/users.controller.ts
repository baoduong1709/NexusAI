import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UpdateChatSettingsDto } from "./dto/update-chat-settings.dto";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions("user:create")
  @ApiOperation({ summary: "Create a new user" })
  create(@CurrentUser() user: any, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.companyId, dto);
  }

  @Get("me/chat-settings")
  @ApiOperation({ summary: "Get chat settings of the current user" })
  getMyChatSettings(@CurrentUser() user: { id: number }) {
    return this.usersService.getChatSettings(user.id);
  }

  @Put("me/chat-settings")
  @ApiOperation({ summary: "Update chat settings of the current user" })
  updateMyChatSettings(
    @CurrentUser() user: { id: number },
    @Body() dto: UpdateChatSettingsDto
  ) {
    return this.usersService.updateChatSettings(user.id, dto);
  }

  @Get()
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "Get all users" })
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAll(user.companyId);
  }

  @Get(":id")
  @RequirePermissions("user:read")
  @ApiOperation({ summary: "Get user by ID" })
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  @RequirePermissions("user:update")
  @ApiOperation({ summary: "Update user" })
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("user:delete")
  @ApiOperation({ summary: "Delete user" })
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
