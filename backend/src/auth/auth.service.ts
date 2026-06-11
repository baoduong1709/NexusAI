import { Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import * as bcrypt from "bcrypt";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role?.name,
      permissions: user.role?.permissions || [],
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
      },
    };
  }

  async getProfile(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        skills: true,
        isActive: true,
        createdAt: true,
        role: {
          select: { id: true, name: true, permissions: true },
        },
      },
    });
  }

  async generatePersonalToken(userId: number, expiresIn: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role?.name,
      permissions: user.role?.permissions || [],
    };

    // 'never' is represented as 100 years (36500 days)
    const jwtExpiresIn = expiresIn === "never" ? "36500d" : expiresIn;

    return {
      token: this.jwtService.sign(payload, { expiresIn: jwtExpiresIn }),
    };
  }
}
