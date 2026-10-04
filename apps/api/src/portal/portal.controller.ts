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
import { ReplaceAvailabilityDto } from '../employees/employees.dto.js';
import { EmployeesService } from '../employees/employees.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
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
  ) {}

  // ─── Time clock ────────────────────────────────────────────────────────

  @Get('clock')
  async clock(@CurrentUser() user: AuthUser) {
    return this.attendance.clockState(user.organizationId, await this.employeeId(user));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/in')
  async clockIn(@CurrentUser() user: AuthUser) {
    return this.attendance.clockIn(user.organizationId, await this.employeeId(user));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/break/start')
  async startBreak(@CurrentUser() user: AuthUser) {
    return this.attendance.startBreak(user.organizationId, await this.employeeId(user));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/break/end')
  async endBreak(@CurrentUser() user: AuthUser) {
    return this.attendance.endBreak(user.organizationId, await this.employeeId(user));
  }

  @HttpCode(HttpStatus.OK)
  @Post('clock/out')
  async clockOut(@CurrentUser() user: AuthUser) {
    return this.attendance.clockOut(user.organizationId, await this.employeeId(user));
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
    return this.swaps.create(user.organizationId, await this.employeeId(user), dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('swaps/:id/respond')
  async respondToSwap(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RespondSwapDto,
  ) {
    return this.swaps.respond(user.organizationId, await this.employeeId(user), id, dto.accept);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('swaps/:id')
  async cancelSwap(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.swaps.cancel(await this.employeeId(user), id);
  }

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
    return this.scheduling.claimOpenShift(
      user.organizationId,
      await this.employeeId(user),
      id,
    );
  }

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
    return employee.availability;
  }

  @Get('time-off')
  async myTimeOff(@CurrentUser() user: AuthUser) {
    return this.timeOff.listMine(await this.employeeId(user));
  }

  @Post('time-off')
  async requestTimeOff(@CurrentUser() user: AuthUser, @Body() dto: CreateTimeOffDto) {
    return this.timeOff.create(await this.employeeId(user), dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('time-off/:id')
  async cancelTimeOff(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.timeOff.cancel(await this.employeeId(user), id);
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
