import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JOB, NOTIFICATIONS_QUEUE, type SchedulePublishedJob } from './jobs.constants.js';
import { NotificationJobs } from './notification-jobs.js';

/** BullMQ worker: routes queued jobs to their handlers. */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly jobs: NotificationJobs) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case JOB.schedulePublished:
        return this.jobs.schedulePublished(job.data as SchedulePublishedJob);
      case JOB.shiftReminders:
        return this.jobs.shiftReminders();
      default:
        this.logger.warn(`Unknown job ${job.name}`);
    }
  }
}
