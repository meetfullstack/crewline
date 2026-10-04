import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from '../attendance/attendance.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { dateRangeLabel, shiftLabel } from '../common/labels.js';
import { ReplaceAvailabilityDto } from '../employees/employees.dto.js';
import { EmployeesService } from '../employees/employees.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../realtime/notifications.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';
import { CreateSwapDto, RespondSwapDto } from '../swaps/swaps.dto.js';
import { SwapsService } from '../swaps/swaps.service.js';
import { CreateTimeOffDto } from '../time-off/time-off.dto.js';
import { TimeOffService } from '../time-off/time-off.service.js';

/**
 * Self-service endpoints for whoever is signed in. Every route acts on the
 * caller's own staff record, so there is no id to tamper with.
 */
@ApiTags('me')
@ApiCookieAuth('cl_access')
@Controller('me')
export class PortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
    private readonly employees: EmployeesService,
    private readonly timeOff: TimeOffService,
    private readonly swaps: SwapsService,
    private readonly attendance: AttendanceService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Time clock ────────────────────────────────────────────────────────

  @Get('clock')
  async clock(@CurrentUser() user: AuthUser) {
    return this.attendance.clockState(user.organizationId, await this.employeeId(user));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/in')
  async clockIn(@CurrentUser() user: AuthUser) {
    return this.clocked(user, this.attendance.clockIn(user.organizationId, await this.employeeId(user)));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/break/start')
  async startBreak(@CurrentUser() user: AuthUser) {
    return this.clocked(user, this.attendance.startBreak(user.organizationId, await this.employeeId(user)));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/break/end')
  async endBreak(@CurrentUser() user: AuthUser) {
    return this.clocked(user, this.attendance.endBreak(user.organizationId, await this.employeeId(user)));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/out')
  async clockOut(@CurrentUser() user: AuthUser) {
    return this.clocked(user, this.attendance.clockOut(user.organizationId, await this.employeeId(user)));
  }

  /** The dashboard's "clocked in now" updates the moment someone clocks. */
  private async clocked<T>(user: AuthUser, work: Promise<T>) {
    const result = await work;
    this.realtime.toManagers(user.organizationId, 'attendance.changed');
    return result;
  }

  // ─── Shift swaps ───────────────────────────────────────────────────────

  @Get('swaps')
  async mySwaps(@CurrentUser() user: AuthUser) {
    return this.swaps.listMine(user.organizationId, await this.employeeId(user));
  }

  @Get('swaps/candidates')
  async swapCandidates(@CurrentUser() user: AuthUser, @Query('shiftId') shiftId: string) {
    return this.swaps.candidates(user.organizationId, await this.employeeId(user), shiftId);
  }

  @Post('swaps')
  async requestSwap(@CurrentUser() user: AuthUser, @Body() dto: CreateSwapDto) {
    const swap = await this.swaps.create(user.organizationId, await this.employeeId(user), dto);
    await this.notifications.notifyEmployees([swap.targetEmployee.id], {
      kind: 'swap-requested',
      title:
        swap.kind === 'TRADE'
          ? `${swap.requester.firstName} wants to trade shifts with you`
          : `${swap.requester.firstName} asked you to cover a shift`,
      body: shiftLabel(swap.shift),
      href: '/swaps',
    });
    this.realtime.toOrg(user.organizationId, 'swaps.changed');
    return swap;
  }

  @HttpCode(HttpStatus.OK)
  @Post('swaps/:id/respond')
  async respondToSwap(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondSwapDto,
  ) {
    const swap = await this.swaps.respond(
      user.organizationId,
      await this.employeeId(user),
      id,
      dto.accept,
    );
    const who = swap.targetEmployee.firstName;
    await this.notifications.notifyEmployees([swap.requester.id], {
      kind: dto.accept ? 'swap-accepted' : 'swap-declined',
      title: dto.accept
        ? `${who} accepted your swap — waiting for a manager`
        : `${who} can’t take your shift`,
      body: shiftLabel(swap.shift),
      href: '/swaps',
    });
    if (dto.accept) {
      await this.notifications.notifyManagers(user.organizationId, {
        kind: 'swap-needs-approval',
        title: `Swap to approve: ${swap.requester.firstName} → ${who}`,
        body: shiftLabel(swap.shift),
        href: '/swaps',
      });
    }
    this.realtime.toOrg(user.organizationId, 'swaps.changed');
    return swap;
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('swaps/:id')
  async cancelSwap(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.swaps.cancel(await this.employeeId(user), id);
    this.realtime.toOrg(user.organizationId, 'swaps.changed');
  }

  // ─── Shifts ────────────────────────────────────────────────────────────

  @Get('shifts')
  async shifts(@CurrentUser() user: AuthUser) {
    return this.scheduling.myShifts(user.organizationId, await this.employeeId(user));
  }

  @Get('open-shifts')
  async openShifts(@CurrentUser() user: AuthUser) {
    return this.scheduling.openShiftsFor(user.organizationId, await this.employeeId(user));
  }

  @HttpCode(HttpStatus.OK)
  @Post('open-shifts/:id/claim')
  async claim(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const shift = await this.scheduling.claimOpenShift(
      user.organizationId,
      await this.employeeId(user),
      id,
    );
    const me = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { firstName: true },
    });
    await this.notifications.notifyManagers(user.organizationId, {
      kind: 'open-shift-claimed',
      title: `${me?.firstName ?? 'Someone'} picked up an open shift`,
      body: shiftLabel(shift),
      href: '/schedule',
    });
    // Everyone's open-shift list shrinks; managers' schedules update.
    this.realtime.toOrg(user.organizationId, 'schedule.changed');
    return shift;
  }

  // ─── Availability ──────────────────────────────────────────────────────

  @Get('availability')
  async availability(@CurrentUser() user: AuthUser) {
    const employee = await this.employees.get(user.organizationId, await this.employeeId(user));
    return employee.availability;
  }

  @Put('availability')
  async replaceAvailability(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReplaceAvailabilityDto,
  ) {
    const employee = await this.employees.replaceAvailability(
      user.organizationId,
      await this.employeeId(user),
      dto,
    );
    this.realtime.toManagers(user.organizationId, 'schedule.changed');
    return employee.availability;
  }

  // ─── Time off ──────────────────────────────────────────────────────────

  @Get('time-off')
  async myTimeOff(@CurrentUser() user: AuthUser) {
    return this.timeOff.listMine(await this.employeeId(user));
  }

  @Post('time-off')
  async requestTimeOff(@CurrentUser() user: AuthUser, @Body() dto: CreateTimeOffDto) {
    const request = await this.timeOff.create(await this.employeeId(user), dto);
    await this.notifications.notifyManagers(
      user.organizationId,
      {
        kind: 'time-off-requested',
        title: `${request.employee.firstName} requested time off`,
        body: dateRangeLabel(request.startDate, request.endDate),
        href: '/time-off',
      },
      user.id,
    );
    this.realtime.toManagers(user.organizationId, 'timeoff.changed');
    return request;
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('time-off/:id')
  async cancelTimeOff(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.timeOff.cancel(await this.employeeId(user), id);
    this.realtime.toManagers(user.organizationId, 'timeoff.changed');
  }

  private async employeeId(user: AuthUser) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!employee) {
      throw new ForbiddenException('Your account isn’t linked to a staff profile');
    }
    return employee.id;
  }
}
