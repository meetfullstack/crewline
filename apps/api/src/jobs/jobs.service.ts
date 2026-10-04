import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  JOB,
  NOTIFICATIONS_QUEUE,
  REMINDER_TICK_MINUTES,
  type SchedulePublishedJob,
} from './jobs.constants.js';

/** The rest of the app enqueues background work through here. */
@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    try {
      // Idempotent: re-registering on every boot just updates the schedule.
      await this.queue.upsertJobScheduler(
        JOB.shiftReminders,
        { every: REMINDER_TICK_MINUTES * 60_000 },
        { name: JOB.shiftReminders },
      );
    } catch (error) {
      this.logger.warn(`Couldn't schedule shift reminders: ${(error as Error).message}`);
    }
  }

  schedulePublished(data: SchedulePublishedJob) {
    return this.queue.add(JOB.schedulePublished, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    });
  }
}
