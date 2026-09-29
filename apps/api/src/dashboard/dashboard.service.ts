import { Injectable, NotFoundException } from '@nestjs/common';
import { addLocalDays, dateColumn, localDateOf } from '../common/time.js';
import { EmploymentStatus, RequestStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SchedulingService } from '../scheduling/scheduling.service.js';

const CERT_WARNING_DAYS = 30;

type Week = Awaited<ReturnType<SchedulingService['getWeek']>>;

/**
 * One call that answers a manager's morning questions: who's in today, are
 * we on budget, and what needs my attention before service.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduling: SchedulingService,
  ) {}

  async overview(organizationId: string, locationId?: string) {
    const location = await this.prisma.location.findFirst({
      where: { organizationId, ...(locationId ? { id: locationId } : {}) },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        timezone: true,
        weeklyLaborBudgetCents: true,
      },
    });
    if (!location) throw new NotFoundException('Location not found');

    const now = new Date();
    const today = localDateOf(now, location.timezone);
    const thisWeek = await this.scheduling.getWeek(organizationId, {
      locationId: location.id,
      weekStart: today,
    });
    const [lastWeek, nextWeek, pendingTimeOff, certifications] =
      await Promise.all([
        this.scheduling.getWeek(organizationId, {
          locationId: location.id,
          weekStart: addLocalDays(thisWeek.weekStart, -7),
        }),
        this.scheduling.getWeek(organizationId, {
          locationId: location.id,
          weekStart: addLocalDays(thisWeek.weekStart, 7),
        }),
        this.pendingTimeOff(organizationId),
        this.certificationAlerts(organizationId, today),
      ]);

    return {
      location: { id: location.id, name: location.name, timezone: location.timezone },
      date: today,
      generatedAt: now,
      staffing: this.todayStaffing(thisWeek, today, now),
      labor: {
        weeklyBudget:
          location.weeklyLaborBudgetCents === null
            ? null
            : location.weeklyLaborBudgetCents / 100,
        week: {
          weekStart: thisWeek.weekStart,
          hours: thisWeek.summary.totalHours,
          cost: thisWeek.summary.laborCost,
          byDay: thisWeek.summary.byDay,
        },
        lastWeek: {
          hours: lastWeek.summary.totalHours,
          cost: lastWeek.summary.laborCost,
          byDay: lastWeek.summary.byDay,
        },
      },
      weeks: [thisWeek, nextWeek].map((w) => this.weekStatus(w)),
      openShiftsNext7Days: [...thisWeek.shifts, ...nextWeek.shifts].filter(
        (s) =>
          !s.employeeId &&
          s.date >= today &&
          s.date <= addLocalDays(today, 6),
      ).length,
      pendingTimeOff,
      certifications,
    };
  }

  private todayStaffing(week: Week, today: string, now: Date) {
    const names = new Map(week.employees.map((e) => [e.id, e]));
    const positions = new Map(week.positions.map((p) => [p.id, p]));
    const shifts = week.shifts
      .filter((s) => s.date === today)
      .map((s) => {
        const employee = s.employeeId ? names.get(s.employeeId) : undefined;
        const state =
          now < s.startsAt ? 'upcoming' : now < s.endsAt ? 'on' : 'done';
        return {
          id: s.id,
          startMinute: s.startMinute,
          endMinute: s.endMinute,
          paidHours: s.paidHours,
          cost: s.cost,
          state,
          position: positions.get(s.positionId) ?? null,
          employee: employee
            ? {
                id: employee.id,
                firstName: employee.firstName,
                lastName: employee.lastName,
              }
            : null,
          conflicts: s.conflicts,
        };
      });
    const day = week.summary.byDay.find((d) => d.date === today);
    return {
      shifts,
      scheduled: shifts.filter((s) => s.employee).length,
      onNow: shifts.filter((s) => s.employee && s.state === 'on').length,
      open: shifts.filter((s) => !s.employee).length,
      hours: day?.hours ?? 0,
      cost: day?.cost ?? 0,
    };
  }

  private weekStatus(week: Week) {
    return {
      weekStart: week.weekStart,
      status: week.schedule?.status ?? null,
      hasUnpublishedChanges: week.schedule?.hasUnpublishedChanges ?? false,
      shifts: week.shifts.length,
      hours: week.summary.totalHours,
      cost: week.summary.laborCost,
      openShifts: week.summary.openShifts,
      errors: week.summary.errors,
      warnings: week.summary.warnings,
    };
  }

  private async pendingTimeOff(organizationId: string) {
    const [count, first] = await Promise.all([
      this.prisma.timeOffRequest.count({
        where: { employee: { organizationId }, status: RequestStatus.PENDING },
      }),
      this.prisma.timeOffRequest.findMany({
        where: { employee: { organizationId }, status: RequestStatus.PENDING },
        orderBy: { startDate: 'asc' },
        take: 3,
        select: {
          id: true,
          startDate: true,
          endDate: true,
          type: true,
          employee: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    return {
      count,
      next: first.map((r) => ({
        ...r,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
      })),
    };
  }

  /** Expired or soon-to-expire certifications for current staff. */
  private async certificationAlerts(organizationId: string, today: string) {
    const rows = await this.prisma.certification.findMany({
      where: {
        employee: {
          organizationId,
          status: { not: EmploymentStatus.TERMINATED },
        },
        expiresAt: {
          lte: dateColumn(addLocalDays(today, CERT_WARNING_DAYS)),
        },
      },
      orderBy: { expiresAt: 'asc' },
      select: {
        id: true,
        name: true,
        expiresAt: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((c) => {
      const expiresAt = c.expiresAt!.toISOString().slice(0, 10);
      return {
        id: c.id,
        name: c.name,
        expiresAt,
        expired: expiresAt < today,
        employee: c.employee,
      };
    });
  }
}
