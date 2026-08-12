import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/permissions.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSystemConfigsDto } from "./dto/system-config.dto";

@ApiTags("AI System Configs")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("ai/system-configs")
export class SystemConfigsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions("system:config:read")
  @ApiOperation({ summary: "Get AI system configs (Admin only)" })
  async getConfigs() {
    const configs = await this.prisma.systemConfig.findMany();
    const result: Record<string, string> = {};
    
    // Default system values (if not configured in DB)
    const defaults = {
      AI_PROVIDER: process.env.AI_PROVIDER || "custom",
      AI_API_BASE: process.env.AI_API_BASE || "https://api.ai-box.vn/v1",
      AI_PRO_MODEL: process.env.AI_MODEL || "deepseek-v4-pro[1m]",
      AI_FLASH_MODEL: process.env.AI_MODEL || "deepseek-v4-flash[1m]", // Fallback if no flash config exists
      AI_SUMMARY_MODEL:
        process.env.AI_SUMMARY_MODEL ||
        process.env.AI_MODEL ||
        "deepseek-v4-flash[1m]",
      AI_EMBEDDING_MODEL:
        process.env.AI_EMBEDDING_MODEL || "text-embedding-3-small",
    };

    // Populate existing configs
    configs.forEach((c) => {
      if (c.key === "AI_API_KEY") {
        // Mask the API Key for security
        result[c.key] = c.value ? `${c.value.slice(0, 6)}••••••••${c.value.slice(-4)}` : "";
      } else {
        result[c.key] = c.value;
      }
    });

    // Merge default values if keys not present in DB
    Object.entries(defaults).forEach(([key, val]) => {
      if (result[key] === undefined) {
        result[key] = val;
      }
    });

    if (result["AI_API_KEY"] === undefined) {
      const envKey = process.env.AI_API_KEY || "";
      result["AI_API_KEY"] = envKey ? `${envKey.slice(0, 6)}••••••••${envKey.slice(-4)}` : "";
    }

    return result;
  }

  @Put()
  @RequirePermissions("system:config:write")
  @ApiOperation({ summary: "Update AI system configs (Admin only)" })
  async updateConfigs(@Body() dto: UpdateSystemConfigsDto) {
    const updates = Object.entries(dto).filter(([_, val]) => val !== undefined);

    await this.prisma.$transaction(
      updates.map(([key, val]) => {
        // If API Key is masked (user didn't change it), don't update it
        if (key === "AI_API_KEY" && val && val.includes("••••")) {
          return this.prisma.systemConfig.findFirst({ where: { key } }); // No-op query basically
        }
        return this.prisma.systemConfig.upsert({
          where: { key },
          update: { value: val! },
          create: { key, value: val! },
        });
      })
    );

    return { success: true };
  }

  @Get('providers')
  @RequirePermissions('system:config:read')
  @ApiOperation({ summary: 'Get available AI providers' })
  async getProviders() {
    return [
      {
        id: 'openai',
        name: 'OpenAI (GPT)',
        icon: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        models: {
          pro: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini'],
          flash: ['gpt-4o-mini', 'gpt-3.5-turbo'],
          summary: ['gpt-4o-mini', 'gpt-3.5-turbo'],
          embedding: ['text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002'],
        },
        description: 'API chính thức từ OpenAI',
      },
      {
        id: 'google',
        name: 'Google Gemini',
        icon: 'google',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        models: {
          pro: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
          flash: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
          summary: ['gemini-2.0-flash', 'gemini-2.0-flash-lite'],
          embedding: ['gemini-embedding-2', 'gemini-embedding-001', 'text-embedding-004', 'text-embedding-005'],
        },
        description: 'Google AI Studio / Vertex AI',
      },
      {
        id: 'claude',
        name: 'Anthropic Claude',
        icon: 'anthropic',
        baseUrl: 'https://api.anthropic.com/v1',
        models: {
          pro: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
          flash: ['claude-3-5-haiku-20241022', 'claude-3-haiku-20240307'],
          summary: ['claude-3-5-haiku-20241022'],
          embedding: [],
        },
        description: 'API từ Anthropic',
        note: 'Claude không hỗ trợ embedding model',
      },
      {
        id: 'deepseek',
        name: 'Deepseek',
        icon: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        models: {
          pro: ['deepseek-chat', 'deepseek-reasoner'],
          flash: ['deepseek-chat'],
          summary: ['deepseek-chat'],
          embedding: [],
        },
        description: 'API từ Deepseek',
      },
      {
        id: 'custom',
        name: 'Custom / OpenAI Compatible',
        icon: 'settings',
        baseUrl: '',
        models: { pro: [], flash: [], summary: [], embedding: [] },
        description: 'Nhập Base URL và model tùy chỉnh',
      },
    ];
  }
}
