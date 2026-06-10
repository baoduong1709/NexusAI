import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateChatSettingsDto } from "./dto/update-chat-settings.dto";
import * as bcrypt from "bcrypt";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  isActive: true,
  skills: true,
  createdAt: true,
  role: { select: { id: true, name: true } },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException("Email already in use");

    const hashed = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { ...dto, password: hashed },
      select: USER_SELECT,
    });
  }

  findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);
    const data: any = { ...dto };
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.user.delete({ where: { id }, select: USER_SELECT });
  }

  async getChatSettings(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        chatLanguage: true,
        chatDescription: true,
      },
    });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async updateChatSettings(userId: number, dto: UpdateChatSettingsDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException("User not found");

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        chatLanguage: true,
        chatDescription: true,
      },
    });
  }
}
