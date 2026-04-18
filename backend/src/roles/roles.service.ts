import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { AVAILABLE_PERMISSIONS } from "../auth/permissions";

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException("Role name already exists");
    return this.prisma.role.create({ data: dto });
  }

  findAll() {
    return this.prisma.role.findMany({ orderBy: { name: "asc" } });
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException("Role not found");
    return role;
  }

  async update(id: number, dto: Partial<CreateRoleDto>) {
    await this.findOne(id);
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.role.delete({ where: { id } });
  }

  getAvailablePermissions() {
    return [...AVAILABLE_PERMISSIONS];
  }
}
