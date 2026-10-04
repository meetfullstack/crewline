import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from './realtime.service.js';

export interface NotificationInput {
  kind: string;
  title: string;
  body?: string;
  href?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Stores a notification for each user and pushes it to their open tabs. */
  async notifyUsers(userIds: (string | null | undefined)[], input: NotificationInput) {
    const ids = [...new Set(userIds.filter((id): id is string => !!id))];
    if (ids.length === 0) return;
    await this.prisma.notification.createMany({
      data: ids.map((userId) => ({ userId, ...input })),
    });
    this.realtime.toUsers(ids, 'notification', input);
  }

  /** As above, addressed by staff record (staff without a login are skipped). */
  async notifyEmployees(employeeIds: string[], input: NotificationInput) {
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { userId: true },
    });
    await this.notifyUsers(employees.map((e) => e.userId), input);
  }

  async notifyManagers(organizationId: string, input: NotificationInput, exceptUserId?: string) {
    const managers = await this.prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['OWNER', 'MANAGER'] },
        id: exceptUserId ? { not: exceptUserId } : undefined,
      },
      select: { id: true },
    });
    await this.notifyUsers(managers.map((m) => m.id), input);
  }

  async list(userId: string) {
    const [items, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true, kind: true, title: true, body: true, href: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return { items, unread };
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
