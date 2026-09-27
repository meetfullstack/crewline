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
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../generated/prisma/enums.js';
import { CreatePositionDto, UpdatePositionDto } from './positions.dto.js';
import { PositionsService } from './positions.service.js';

@ApiTags('positions')
@ApiCookieAuth('cl_access')
@Controller('positions')
export class PositionsController {
  constructor(private readonly positions: PositionsService) {}

  // Everyone can read positions: the employee portal labels shifts with them.
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.positions.list(user.organizationId);
  }

  @Roles(Role.MANAGER)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePositionDto) {
    return this.positions.create(user.organizationId, dto);
  }

  @Roles(Role.MANAGER)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePositionDto,
  ) {
    return this.positions.update(user.organizationId, id, dto);
  }

  @Roles(Role.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.positions.remove(user.organizationId, id);
  }
}
