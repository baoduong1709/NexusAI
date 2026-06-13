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
