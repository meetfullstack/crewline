import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { EditEntryDto, ManualEntryDto, TimesheetQuery } from './attendance.dto.js';
import { AttendanceService } from './attendance.service.js';

/** Manager side of time & attendance. Staff clock in via /me/clock. */
@ApiTags('attendance')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller()
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get('timesheets')
  timesheet(@CurrentUser() user: AuthUser, @Query() query: TimesheetQuery) {
    return this.attendance.timesheet(user.organizationId, query);
  }

  @Post('time-entries')
  async create(@CurrentUser() user: AuthUser, @Body() dto: ManualEntryDto) {
    const entry = await this.attendance.createEntry(user.organizationId, user.id, dto);
    this.realtime.toManagers(user.organizationId, 'attendance.changed');
    return entry;
  }

  @Patch('time-entries/:id')
  async edit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EditEntryDto) {
    const entry = await this.attendance.editEntry(user.organizationId, user.id, id, dto);
    this.realtime.toManagers(user.organizationId, 'attendance.changed');
    return entry;
  }
}
