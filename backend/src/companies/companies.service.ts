import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
    });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async update(id: number, data: { name: string }) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return this.prisma.company.update({
      where: { id },
      data: { name: data.name },
    });
  }

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        _count: {
          select: { users: true, projects: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { name: string }) {
    return this.prisma.company.create({
      data: {
        name: data.name,
      },
    });
  }

  async createAdmin(companyId: number, data: any) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const adminRole = await this.prisma.role.findFirst({
      where: { name: 'Admin' },
    });
    if (!adminRole) throw new NotFoundException('Admin role not found');

    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new Error('Email already in use');
    }

    const bcrypt = require('bcrypt');
    const hashed = await bcrypt.hash(data.password, 10);

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashed,
        companyId,
        roleId: adminRole.id,
        isSuperAdmin: false,
        skills: [],
      },
      select: { id: true, name: true, email: true },
    });
  }

  async remove(id: number) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return this.prisma.company.delete({
      where: { id },
    });
  }
}
