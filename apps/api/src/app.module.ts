import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { validateEnv } from './config/env.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthController } from './health/health.controller.js';
import { LocationsController } from './locations/locations.controller.js';
import { PortalModule } from './portal/portal.module.js';
import { PositionsModule } from './positions/positions.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SchedulingModule } from './scheduling/scheduling.module.js';
import { TimeOffModule } from './time-off/time-off.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    PositionsModule,
    SchedulingModule,
    TimeOffModule,
    PortalModule,
  ],
  controllers: [HealthController, LocationsController],
  providers: [
    // Order matters: rate-limit, then authenticate, then authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
