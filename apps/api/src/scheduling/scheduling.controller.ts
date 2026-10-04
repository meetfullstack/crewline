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
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import {
  CopyWeekDto,
  PublishDto,
  ShiftInputDto,
  UpdateShiftDto,
  WeekQuery,
} from './scheduling.dto.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { SchedulingService } from './scheduling.service.js';

class CheckShiftDto extends ShiftInputDto {
  @ApiProperty({ required: false, description: 'Set when editing an existing shift' })
  @IsOptional()
  @IsString()
  shiftId?: string;
}

@ApiTags('scheduling')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller()
export class SchedulingController {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Other managers looking at the schedule refresh live. */
  private async changed<T>(user: AuthUser, work: Promise<T>): Promise<T> {
    const result = await work;
    this.realtime.toManagers(user.organizationId, 'schedule.changed');
    return result;
  }

  @Get('schedules/week')
  week(@CurrentUser() user: AuthUser, @Query() query: WeekQuery) {
    return this.scheduling.getWeek(user.organizationId, query);
  }

  @HttpCode(HttpStatus.OK)
  @Post('schedules/copy')
  copy(@CurrentUser() user: AuthUser, @Body() dto: CopyWeekDto) {
    return this.changed(user, this.scheduling.copyWeek(user.organizationId, dto));
  }

  @HttpCode(HttpStatus.OK)
  @Post('schedules/publish')
  publish(@CurrentUser() user: AuthUser, @Body() dto: PublishDto) {
    return this.scheduling.publish(user.organizationId, dto.locationId, dto.weekStart);
  }

  @Post('shifts')
  createShift(@CurrentUser() user: AuthUser, @Body() dto: ShiftInputDto) {
    return this.changed(user, this.scheduling.createShift(user.organizationId, dto));
  }

  @HttpCode(HttpStatus.OK)
  @Post('shifts/check')
  checkShift(@CurrentUser() user: AuthUser, @Body() dto: CheckShiftDto) {
    return this.scheduling.checkShift(user.organizationId, dto);
  }

  @Patch('shifts/:id')
  updateShift(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.changed(user, this.scheduling.updateShift(user.organizationId, id, dto));
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('shifts/:id')
  deleteShift(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.changed(user, this.scheduling.deleteShift(user.organizationId, id));
  }
}
