import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { EditEntryDto, ManualEntryDto, TimesheetQuery } from './attendance.dto.js';
import { AttendanceService } from './attendance.service.js';

/** Manager side of time & attendance. Staff clock in via /me/clock. */
@ApiTags('attendance')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('timesheets')
  timesheet(@CurrentUser() user: AuthUser, @Query() query: TimesheetQuery) {
    return this.attendance.timesheet(user.organizationId, query);
  }

  @Post('time-entries')
  create(@CurrentUser() user: AuthUser, @Body() dto: ManualEntryDto) {
    return this.attendance.createEntry(user.organizationId, user.id, dto);
  }

  @Patch('time-entries/:id')
  edit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: EditEntryDto) {
    return this.attendance.editEntry(user.organizationId, user.id, id, dto);
  }
}
