import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeService } from './realtime.service.js';

/** Global so any feature can push events or notify people. */
@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationsController],
  providers: [RealtimeService, RealtimeGateway, NotificationsService],
  exports: [RealtimeService, NotificationsService],
})
export class RealtimeModule {}
