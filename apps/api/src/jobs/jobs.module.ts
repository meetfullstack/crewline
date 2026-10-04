import { BullModule } from '@nestjs/bullmq';
import { type DynamicModule, Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { NOTIFICATIONS_QUEUE } from './jobs.constants.js';
import { InlineJobsService, JobsService, QueuedJobsService } from './jobs.service.js';
import { NotificationJobs } from './notification-jobs.js';
import { NotificationsProcessor } from './notifications.processor.js';

/**
 * Background work. With REDIS_URL it runs on BullMQ (retries, a repeatable
 * reminder job); without it, the same handlers run in-process so the app
 * still deploys on hosts with no Redis.
 */
@Global()
@Module({})
export class JobsModule {
  static register(): DynamicModule {
    // ConfigModule.forRoot has already loaded .env by the time this runs.
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      return {
        module: JobsModule,
        providers: [NotificationJobs, { provide: JobsService, useClass: InlineJobsService }],
        exports: [JobsService],
      };
    }

    return {
      module: JobsModule,
      imports: [
        // BullMQ in an ESM app needs a constructed client; it duplicates
        // this connection for workers as needed.
        BullModule.forRoot({
          connection: new Redis(redisUrl, { maxRetriesPerRequest: null }),
        }),
        BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
      ],
      providers: [
        NotificationJobs,
        NotificationsProcessor,
        { provide: JobsService, useClass: QueuedJobsService },
      ],
      exports: [JobsService],
    };
  }
}
