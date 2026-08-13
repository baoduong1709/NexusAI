import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "../notifications/notification.service";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { UpdateLeaveRequestDto } from "./dto/update-leave-request.dto";
import { ReviewLeaveRequestDto, ReviewAction } from "./dto/review-leave-request.dto";
import { LeaveStatus, Prisma } from "@prisma/client";

const LEAVE_REQUEST_SELECT = {
  id: true,
  userId: true,
  companyId: true,
  type: true,
  startDate: true,
  endDate: true,
  totalDays: true,
  reason: true,
  status: true,
  reviewerId: true,
  reviewerNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { id: true, name: true, email: true } },
  reviewer: { select: { id: true, name: true } },
};

@Injectable()
export class LeaveRequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const curDate = new Date(startDate.getTime());
    while (curDate <= endDate) {
      const dayOfWeek = curDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
      curDate.setDate(curDate.getDate() + 1);
    }
    return count;
  }

  async create(userId: number, companyId: number | null, dto: CreateLeaveRequestDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException("endDate must be greater than or equal to startDate");
    }

    const totalDays = this.calculateWorkingDays(startDate, endDate);
    if (totalDays === 0) {
      throw new BadRequestException("Leave request must contain at least one working day");
    }

    const overlappingLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        userId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (overlappingLeaves.length > 0) {
      throw new BadRequestException("Leave dates overlap with existing pending or approved requests");
    }

    return this.prisma.leaveRequest.create({
      data: {
        userId,
        companyId,
        type: dto.type,
        startDate,
        endDate,
        totalDays,
        reason: dto.reason,
      },
      select: LEAVE_REQUEST_SELECT,
    });
  }

  async findAll(
    userId: number,
    companyId: number | null,
    canReadAll: boolean,
    filters?: { status?: string; type?: string },
  ) {
    const where: Prisma.LeaveRequestWhereInput = {};

    if (!canReadAll) {
      where.userId = userId;
    } else if (companyId) {
      where.companyId = companyId;
    }

    if (filters?.status) {
      where.status = filters.status as LeaveStatus;
    }
    if (filters?.type) {
      where.type = filters.type as any;
    }

    return this.prisma.leaveRequest.findMany({
      where,
      select: LEAVE_REQUEST_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: number) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id },
      select: LEAVE_REQUEST_SELECT,
    });

    if (!leaveRequest) {
      throw new NotFoundException("Leave request not found");
    }

    return leaveRequest;
  }

  async update(id: number, userId: number, dto: UpdateLeaveRequestDto) {
    const leaveRequest = await this.findOne(id);

    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException("You can only update your own leave requests");
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Can only update pending leave requests");
    }

    const updateData: Prisma.LeaveRequestUpdateInput = {
      type: dto.type,
      reason: dto.reason,
    };

    let startDate = leaveRequest.startDate;
    let endDate = leaveRequest.endDate;

    if (dto.startDate || dto.endDate) {
      startDate = dto.startDate ? new Date(dto.startDate) : startDate;
      endDate = dto.endDate ? new Date(dto.endDate) : endDate;

      if (endDate < startDate) {
        throw new BadRequestException("endDate must be greater than or equal to startDate");
      }
      
      const totalDays = this.calculateWorkingDays(startDate, endDate);
      if (totalDays === 0) {
        throw new BadRequestException("Leave request must contain at least one working day");
      }

      updateData.startDate = startDate;
      updateData.endDate = endDate;
      updateData.totalDays = totalDays;
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: updateData,
      select: LEAVE_REQUEST_SELECT,
    });
  }

  async review(id: number, reviewerId: number, dto: ReviewLeaveRequestDto) {
    const leaveRequest = await this.findOne(id);

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Can only review pending leave requests");
    }

    const newStatus = dto.status === ReviewAction.APPROVED ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewerId,
        reviewerNote: dto.reviewerNote,
        reviewedAt: new Date(),
      },
      select: LEAVE_REQUEST_SELECT,
    });

    await this.notificationService.create(updated.userId, {
      title: `Leave Request ${newStatus}`,
      message: `Your leave request from ${updated.startDate.toLocaleDateString()} to ${updated.endDate.toLocaleDateString()} has been ${newStatus.toLowerCase()}.`,
      type: "LEAVE_REQUEST",
    });

    return updated;
  }

  async cancel(id: number, userId: number) {
    const leaveRequest = await this.findOne(id);

    if (leaveRequest.userId !== userId) {
      throw new ForbiddenException("You can only cancel your own leave requests");
    }

    if (leaveRequest.status !== LeaveStatus.PENDING) {
      throw new BadRequestException("Can only cancel pending leave requests");
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveStatus.CANCELLED },
      select: LEAVE_REQUEST_SELECT,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.leaveRequest.delete({
      where: { id },
    });
  }
}
