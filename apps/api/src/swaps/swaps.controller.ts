import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { ListSwapsQuery, ReviewSwapDto } from './swaps.dto.js';
import { SwapsService } from './swaps.service.js';

/** Manager side of shift swaps. Staff use /me/swaps. */
@ApiTags('swaps')
@ApiCookieAuth('cl_access')
@Roles(Role.MANAGER)
@Controller('swaps')
export class SwapsController {
  constructor(private readonly swaps: SwapsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListSwapsQuery) {
    return this.swaps.listForOrganization(user.organizationId, query);
  }

  @Patch(':id')
  review(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReviewSwapDto,
  ) {
    return this.swaps.review(user.organizationId, user.id, id, dto);
  }
}
