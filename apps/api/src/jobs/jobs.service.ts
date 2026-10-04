import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  JOB,
  NOTIFICATIONS_QUEUE,
  REMINDER_TICK_MINUTES,
  type SchedulePublishedJob,
} from './jobs.constants.js';
import { NotificationJobs } from './notification-jobs.js';

/** What the rest of the app calls to run background work. */
export abstract class JobsService {
  abstract schedulePublished(data: SchedulePublishedJob): Promise<unknown>;
}

/** Redis available: queue the work for the BullMQ worker. */
@Injectable()
export class QueuedJobsService extends JobsService implements OnModuleInit {
  private readonly logger = new Logger(QueuedJobsService.name);

  constructor(@InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue) {
    super();
  }

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

/**
 * No Redis (e.g. a free-tier deployment): run the same work in-process.
 * Notifications still go out; only the timed shift reminders are skipped.
 */
@Injectable()
export class InlineJobsService extends JobsService implements OnModuleInit {
  private readonly logger = new Logger(InlineJobsService.name);

  constructor(private readonly jobs: NotificationJobs) {
    super();
  }

  onModuleInit() {
    this.logger.log('REDIS_URL not set: background jobs run inline, shift reminders are off');
  }

  schedulePublished(data: SchedulePublishedJob) {
    // Not awaited by callers' critical path; errors are logged, not thrown.
    return this.jobs.schedulePublished(data).catch((error: Error) => {
      this.logger.error(`Publish notifications failed: ${error.message}`);
    });
  }
}
