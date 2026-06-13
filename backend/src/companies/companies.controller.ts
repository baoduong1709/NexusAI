import { Controller, Get, Post, Put, Delete, Body, Param, Patch, UseGuards, Request, ForbiddenException, ParseIntPipe } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { RequireSuperAdmin } from '../auth/decorators/super-admin.decorator';

@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  getCurrentCompany(@Request() req: any) {
    if (!req.user.companyId) {
      throw new ForbiddenException('User does not belong to a company');
    }
    return this.companiesService.findOne(req.user.companyId);
  }

  @Patch('current')
  updateCurrentCompany(@Request() req: any, @Body() updateCompanyDto: { name: string }) {
    if (!req.user.companyId) {
      throw new ForbiddenException('User does not belong to a company');
    }
    return this.companiesService.update(req.user.companyId, updateCompanyDto);
  }

  // --- Super Admin Endpoints ---

  @Get()
  @UseGuards(SuperAdminGuard)
  @RequireSuperAdmin()
  findAll() {
    return this.companiesService.findAll();
  }

  @Post()
  @UseGuards(SuperAdminGuard)
  @RequireSuperAdmin()
  create(@Body() createCompanyDto: { name: string }) {
    return this.companiesService.create(createCompanyDto);
  }

  @Put(':id')
  @UseGuards(SuperAdminGuard)
  @RequireSuperAdmin()
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCompanyDto: { name: string }) {
    return this.companiesService.update(id, updateCompanyDto);
  }

  @Delete(':id')
  @UseGuards(SuperAdminGuard)
  @RequireSuperAdmin()
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.remove(id);
  }
}
