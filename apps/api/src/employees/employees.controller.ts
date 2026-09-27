import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  CreateCertificationDto,
  CreateEmployeeDto,
  ListEmployeesQuery,
  ReplaceAvailabilityDto,
  UpdateEmployeeDto,
} from './employees.dto.js';
import { EmployeesService } from './employees.service.js';

@ApiTags('employees')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListEmployeesQuery) {
    return this.employees.list(user.organizationId, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.get(user.organizationId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(user.organizationId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(user.organizationId, id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.employees.remove(user.organizationId, id);
  }

  @Put(':id/availability')
  replaceAvailability(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReplaceAvailabilityDto,
  ) {
    return this.employees.replaceAvailability(user.organizationId, id, dto);
  }

  @Post(':id/certifications')
  addCertification(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateCertificationDto,
  ) {
    return this.employees.addCertification(user.organizationId, id, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/certifications/:certificationId')
  removeCertification(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('certificationId') certificationId: string,
  ) {
    return this.employees.removeCertification(
      user.organizationId,
      id,
      certificationId,
    );
  }
}
