import { Controller, Get, Query, UseGuards, Request, ParseIntPipe } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { PrismaService } from "../prisma/prisma.service";

@ApiTags("AI Token Stats")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("ai/token-stats")
export class TokenStatsController {
  constructor(private readonly prisma: PrismaService) {}

  // Helper to check if current user is admin/has read all tokens permission
  private hasAdminPermission(req: any): boolean {
    const userPermissions = req.user?.permissions || [];
    return userPermissions.includes("token:read");
  }

  @Get("summary")
  @ApiOperation({ summary: "Get token usage summary" })
  @ApiQuery({ name: "userId", required: false, type: Number })
  async getSummary(@Request() req: any, @Query("userId") queryUserId?: string) {
    const isAdmin = this.hasAdminPermission(req);
    let targetUserId = req.user.id;

    if (isAdmin && queryUserId) {
      targetUserId = parseInt(queryUserId, 10);
    }

    const whereClause: any = {};
    if (!isAdmin || (isAdmin && queryUserId)) {
      whereClause.userId = targetUserId;
    }

    const aggregations = await this.prisma.aiTokenLog.aggregate({
      where: whereClause,
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
      },
      _count: {
        id: true,
      }
    });

    const modelBreakdown = await this.prisma.aiTokenLog.groupBy({
      by: ["model"],
      where: whereClause,
      _sum: {
        totalTokens: true,
      }
    });

    return {
      totalRequests: aggregations._count.id,
      promptTokens: aggregations._sum.promptTokens || 0,
      completionTokens: aggregations._sum.completionTokens || 0,
      totalTokens: aggregations._sum.totalTokens || 0,
      modelBreakdown: modelBreakdown.map((item) => ({
        model: item.model,
        totalTokens: item._sum.totalTokens || 0,
      })),
    };
  }

  @Get("charts")
  @ApiOperation({ summary: "Get token usage chart data (Last 7 Days)" })
  @ApiQuery({ name: "userId", required: false, type: Number })
  async getCharts(@Request() req: any, @Query("userId") queryUserId?: string) {
    const isAdmin = this.hasAdminPermission(req);
    let targetUserId = req.user.id;

    if (isAdmin && queryUserId) {
      targetUserId = parseInt(queryUserId, 10);
    }

    const whereClause: any = {};
    if (!isAdmin || (isAdmin && queryUserId)) {
      whereClause.userId = targetUserId;
    }

    // Filter logs in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    whereClause.createdAt = {
      gte: sevenDaysAgo,
    };

    const logs = await this.prisma.aiTokenLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        model: true,
      }
    });

    // Group logs by date
    const chartData: Record<string, { date: string; promptTokens: number; completionTokens: number; totalTokens: number }> = {};
    
    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      chartData[d.toISOString().split("T")[0]] = {
        date: dateStr,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      };
    }

    logs.forEach((log) => {
      const dateKey = log.createdAt.toISOString().split("T")[0];
      if (chartData[dateKey]) {
        chartData[dateKey].promptTokens += log.promptTokens;
        chartData[dateKey].completionTokens += log.completionTokens;
        chartData[dateKey].totalTokens += log.totalTokens;
      }
    });

    return Object.values(chartData);
  }

  @Get("history")
  @ApiOperation({ summary: "Get detailed token request history" })
  @ApiQuery({ name: "userId", required: false, type: Number })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async getHistory(
    @Request() req: any, 
    @Query("userId") queryUserId?: string,
    @Query("page") pageStr = "1",
    @Query("limit") limitStr = "10"
  ) {
    const isAdmin = this.hasAdminPermission(req);
    let targetUserId = req.user.id;

    if (isAdmin && queryUserId) {
      targetUserId = parseInt(queryUserId, 10);
    }

    const whereClause: any = {};
    if (!isAdmin || (isAdmin && queryUserId)) {
      whereClause.userId = targetUserId;
    }

    const page = Math.max(1, parseInt(pageStr, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limitStr, 10)));
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.aiTokenLog.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            }
          }
        }
      }),
      this.prisma.aiTokenLog.count({ where: whereClause }),
    ]);

    return {
      data: logs.map(l => ({
        id: l.id,
        userName: l.user.name,
        userEmail: l.user.email,
        model: l.model,
        promptTokens: l.promptTokens,
        completionTokens: l.completionTokens,
        totalTokens: l.totalTokens,
        requestType: l.requestType,
        createdAt: l.createdAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }
}
