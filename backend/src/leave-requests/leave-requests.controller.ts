import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Put,
  ParseIntPipe,
} from "@nestjs/common";
import { LeaveRequestsService } from "./leave-requests.service";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import { ReviewLeaveRequestDto } from "./dto/review-leave-request.dto";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { User } from "@prisma/client";

@ApiTags("Leave Requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("leave-requests")
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  @RequirePermissions("leave:create")
  create(
    @CurrentUser() user: User,
    @Body() createLeaveRequestDto: CreateLeaveRequestDto,
  ) {
    return this.leaveRequestsService.create(user.id, user.companyId, createLeaveRequestDto);
  }

  @Get()
  findAll(
    @CurrentUser() user: any,
    @Query("status") status?: string,
    @Query("type") type?: string,
  ) {
    const canReadAll = Array.isArray(user.permissions) && user.permissions.includes("leave:read");
    return this.leaveRequestsService.findAll(user.id, user.companyId, canReadAll, { status, type });
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.leaveRequestsService.findOne(id);
  }

  @Put(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() updateLeaveRequestDto: UpdateLeaveRequestDto,
  ) {
    return this.leaveRequestsService.update(id, user.id, updateLeaveRequestDto);
  }

  @Patch(":id/review")
  @RequirePermissions("leave:approve")
  review(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: User,
    @Body() reviewLeaveRequestDto: ReviewLeaveRequestDto,
  ) {
    return this.leaveRequestsService.review(id, user.id, reviewLeaveRequestDto);
  }

  @Patch(":id/cancel")
  cancel(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: User) {
    return this.leaveRequestsService.cancel(id, user.id);
  }

  @Delete(":id")
  @RequirePermissions("leave:delete")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.leaveRequestsService.remove(id);
  }
}
