import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { shiftLabel } from '../common/labels.js';
import { Role } from '../generated/prisma/enums.js';
import { NotificationsService } from '../realtime/notifications.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { ListSwapsQuery, ReviewSwapDto } from './swaps.dto.js';
import { SwapsService } from './swaps.service.js';

/** Manager side of shift swaps. Staff use /me/swaps. */
@ApiTags('swaps')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller('swaps')
export class SwapsController {
  constructor(
    private readonly swaps: SwapsService,
    private readonly realtime: RealtimeService,
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListSwapsQuery) {
    return this.swaps.listForOrganization(user.organizationId, query);
  }

  @Patch(':id')
  async review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewSwapDto,
  ) {
    const swap = await this.swaps.review(user.organizationId, user.id, id, dto);
    const approved = swap.status === 'APPROVED';
    await this.notifications.notifyEmployees([swap.requester.id, swap.targetEmployee.id], {
      kind: approved ? 'swap-approved' : 'swap-denied',
      title: approved
        ? `Swap approved: ${swap.requester.firstName} ↔ ${swap.targetEmployee.firstName}`
        : `Your swap was denied`,
      body: [shiftLabel(swap.shift), swap.reviewNote].filter(Boolean).join(' · '),
      href: approved ? '/me/shifts' : '/swaps',
    });
    this.realtime.toOrg(user.organizationId, 'swaps.changed');
    if (approved) this.realtime.toOrg(user.organizationId, 'schedule.changed');
    return swap;
  }
}
