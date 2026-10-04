import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import type { Env } from '../config/env.js';
import { NOTIFICATIONS_QUEUE } from './jobs.constants.js';
import { JobsService } from './jobs.service.js';
import { NotificationsProcessor } from './notifications.processor.js';

/** Background work on BullMQ + Redis: notification fan-out and reminders. */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      // BullMQ in an ESM app needs a constructed client; it duplicates this
      // connection for workers as needed.
      useFactory: (config: ConfigService<Env, true>) => ({
        connection: new Redis(config.get('REDIS_URL', { infer: true }), {
          maxRetriesPerRequest: null,
        }),
      }),
    }),
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  providers: [JobsService, NotificationsProcessor],
  exports: [JobsService],
})
export class JobsModule {}
