import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { dateRangeLabel } from '../common/labels.js';
import { Role } from '../generated/prisma/enums.js';
import { NotificationsService } from '../realtime/notifications.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ListTimeOffQuery, ReviewTimeOffDto } from './time-off.dto.js';
import { TimeOffService } from './time-off.service.js';

/** Manager side of time off. Employees use /me/time-off. */
@ApiTags('time-off')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller('time-off')
export class TimeOffController {
  constructor(
    private readonly timeOff: TimeOffService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTimeOffQuery) {
    return this.timeOff.listForOrganization(user.organizationId, query);
  }

  @Patch(':id')
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewTimeOffDto,
  ) {
    const request = await this.timeOff.review(user.organizationId, user.id, id, dto);
    const approved = request.status === 'APPROVED';
    await this.notifications.notifyEmployees([request.employee.id], {
      kind: approved ? 'time-off-approved' : 'time-off-denied',
      title: `Your time off was ${approved ? 'approved' : 'denied'}`,
      body: [dateRangeLabel(request.startDate, request.endDate), request.reviewNote]
        .filter(Boolean)
        .join(' · '),
      href: '/time-off',
    });
    this.realtime.toOrg(user.organizationId, 'timeoff.changed');
    // Approved time off shows up (and flags conflicts) on the schedule.
    if (approved) this.realtime.toManagers(user.organizationId, 'schedule.changed');
    return request;
  }
}
