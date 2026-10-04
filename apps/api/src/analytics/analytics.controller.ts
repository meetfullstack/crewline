import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { AnalyticsService } from './analytics.service.js';

class AnalyticsQuery {
  @ApiPropertyOptional({ description: 'Defaults to the first location' })
  @IsOptional()
  @IsString()
  locationId?: string;

  @ApiPropertyOptional({ minimum: 4, maximum: 26, default: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(26)
  weeks?: number;
}

@ApiTags('analytics')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQuery) {
    return this.analytics.overview(user.organizationId, query.locationId, query.weeks ?? 8);
  }
}
