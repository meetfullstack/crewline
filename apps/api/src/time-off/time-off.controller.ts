import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { ListTimeOffQuery, ReviewTimeOffDto } from './time-off.dto.js';
import { TimeOffService } from './time-off.service.js';

/** Manager side of time off. Employees use /me/time-off. */
@ApiTags('time-off')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller('time-off')
export class TimeOffController {
  constructor(private readonly timeOff: TimeOffService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTimeOffQuery) {
    return this.timeOff.listForOrganization(user.organizationId, query);
  }

  @Patch(':id')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewTimeOffDto,
  ) {
    return this.timeOff.review(user.organizationId, user.id, id, dto);
  }
}
