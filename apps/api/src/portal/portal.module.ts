import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module.js';
import { SchedulingModule } from '../scheduling/scheduling.module.js';
import { SwapsModule } from '../swaps/swaps.module.js';
import { TimeOffModule } from '../time-off/time-off.module.js';
import { PortalController } from './portal.controller.js';

@Module({
  imports: [EmployeesModule, SchedulingModule, SwapsModule, TimeOffModule],
  controllers: [PortalController],
})
export class PortalModule {}
