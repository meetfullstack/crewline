import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('notifications')
@ApiCookieAuth('cl_access')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    await this.notifications.markAllRead(user.id);
  }
}
