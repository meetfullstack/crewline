import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { DashboardService } from './dashboard.service.js';

class DashboardQuery {
  @ApiPropertyOptional({ description: 'Defaults to the first location' })
  @IsOptional()
  @IsString()
  locationId?: string;
}

@ApiTags('dashboard')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query() query: DashboardQuery) {
    return this.dashboard.overview(user.organizationId, query.locationId);
  }
}
