import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { localMinutesOf } from '../common/time.js';
import { ScheduleStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../realtime/notifications.service.js';
import {
  JOB,
  NOTIFICATIONS_QUEUE,
  REMINDER_LEAD_MINUTES,
  REMINDER_TICK_MINUTES,
  type SchedulePublishedJob,
} from './jobs.constants.js';

const clock = (minutes: number) => {
  const h24 = Math.floor(minutes / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(minutes % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
};

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case JOB.schedulePublished:
        return this.schedulePublished(job.data as SchedulePublishedJob);
      case JOB.shiftReminders:
        return this.shiftReminders();
      default:
        this.logger.warn(`Unknown job ${job.name}`);
    }
  }

  /** Tell everyone on a newly published week that their shifts are live. */
  private async schedulePublished(data: SchedulePublishedJob) {
    const shifts = await this.prisma.shift.findMany({
      where: { scheduleId: data.scheduleId, employeeId: { not: null } },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    const employeeIds = shifts.map((s) => s.employeeId!);
    await this.notifications.notifyEmployees(employeeIds, {
      kind: 'schedule-published',
      title: data.republished
        ? `Schedule updated for ${data.weekLabel}`
        : `Your schedule for ${data.weekLabel} is out`,
      body: data.republished
        ? 'Your manager made changes — check your shifts.'
        : 'Tap to see your shifts for the week.',
      href: '/me/shifts',
    });
    return { notified: employeeIds.length };
  }

  /**
   * Runs every few minutes: reminds staff whose published shift starts about
   * two hours from now. The shift id in the link de-duplicates reminders.
   */
  private async shiftReminders() {
    const tick = REMINDER_TICK_MINUTES * 60_000;
    const windowStart = Math.floor(Date.now() / tick) * tick + REMINDER_LEAD_MINUTES * 60_000;
    const shifts = await this.prisma.shift.findMany({
      where: {
        employeeId: { not: null },
        schedule: { status: ScheduleStatus.PUBLISHED },
        startsAt: { gte: new Date(windowStart), lt: new Date(windowStart + tick) },
      },
      select: {
        id: true,
        startsAt: true,
        employee: { select: { userId: true } },
        position: { select: { name: true } },
        location: { select: { name: true, timezone: true } },
      },
    });

    let sent = 0;
    for (const shift of shifts) {
      const userId = shift.employee?.userId;
      if (!userId) continue;
      const href = `/me/shifts#${shift.id}`;
      const already = await this.prisma.notification.count({
        where: { userId, kind: 'shift-reminder', href },
      });
      if (already) continue;
      await this.notifications.notifyUsers([userId], {
        kind: 'shift-reminder',
        title: `Your shift starts at ${clock(localMinutesOf(shift.startsAt, shift.location.timezone))}`,
        body: `${shift.position.name} · ${shift.location.name}`,
        href,
      });
      sent++;
    }
    return { sent };
  }
}
