import { Module } from '@nestjs/common';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [SchedulingModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
