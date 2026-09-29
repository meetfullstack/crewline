import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CreateLocationDto, UpdateLocationDto } from './locations.dto.js';
import { LocationsService } from './locations.service.js';

@ApiTags('locations')
@ApiCookieAuth('cl_access')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.locations.list(user.organizationId);
  }

  /** Opening a new restaurant is an owner decision. */
  @Roles(Role.OWNER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLocationDto) {
    return this.locations.create(user.organizationId, dto);
  }

  @Roles(Role.MANAGER)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locations.update(user.organizationId, id, dto);
  }
}
