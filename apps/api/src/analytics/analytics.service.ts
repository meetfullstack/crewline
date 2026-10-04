import { Injectable, NotFoundException } from '@nestjs/common';
import {
  attendanceFor,
  workedMinutes,
} from '../attendance/attendance.rules.js';
import {
  addLocalDays,
  dayOfWeekOf,
  localDateOf,
  weekStartOf,
  zonedInstant,
} from '../common/time.js';
import { ScheduleStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OVERTIME_THRESHOLD_HOURS, paidHours } from '../scheduling/conflicts.js';

type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (part: number, whole: number) => (whole ? round1((part / whole) * 100) : 0);

/**
 * Labour analytics over a run of weeks: what was scheduled, what was
 * actually worked and paid, how attendance went and where overtime builds.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string, locationId: string | undefined, weekCount: number) {
    const location = await this.prisma.location.findFirst({
      where: { organizationId, ...(locationId ? { id: locationId } : {}) },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, timezone: true, weekStartsOn: true, weeklyLaborBudgetCents: true },
    });
    if (!location) throw new NotFoundException('Location not found');
    const tz = location.timezone;
    const now = new Date();

    // The last `weekCount` weeks, ending with the current one.
    const currentWeek = weekStartOf(now, tz, location.weekStartsOn as WeekDay);
    const weekStarts = Array.from({ length: weekCount }, (_, i) =>
      addLocalDays(currentWeek, -7 * (weekCount - 1 - i)),
    );
    const from = zonedInstant(weekStarts[0], 0, tz);
    const to = zonedInstant(addLocalDays(currentWeek, 7), 0, tz);
    const weekOf = (d: Date) => weekStartOf(d, tz, location.weekStartsOn as WeekDay);

    const [shifts, entries] = await Promise.all([
      this.prisma.shift.findMany({
        where: {
          locationId: location.id,
          employeeId: { not: null },
          schedule: { status: ScheduleStatus.PUBLISHED },
          startsAt: { gte: from, lt: to },
        },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          breakMinutes: true,
          employeeId: true,
          position: { select: { id: true, name: true, color: true } },
          employee: { select: { firstName: true, lastName: true, hourlyRateCents: true } },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: { locationId: location.id, clockInAt: { gte: from, lt: to } },
        select: {
          shiftId: true,
          employeeId: true,
          clockInAt: true,
          clockOutAt: true,
          breaks: { select: { startAt: true, endAt: true } },
          employee: { select: { hourlyRateCents: true } },
        },
      }),
    ]);

    const entriesByShift = new Map<string, typeof entries>();
    for (const e of entries) {
      if (!e.shiftId) continue;
      entriesByShift.set(e.shiftId, [...(entriesByShift.get(e.shiftId) ?? []), e]);
    }

    // ─── Weekly series ──────────────────────────────────────────────────
    const weeks = weekStarts.map((weekStart) => ({
      weekStart,
      scheduledHours: 0,
      scheduledCost: 0,
      workedHours: 0,
      actualWages: 0,
      shifts: 0,
      late: 0,
      noShows: 0,
    }));
    const weekIndex = new Map(weekStarts.map((w, i) => [w, i]));

    const byPosition = new Map<string, { name: string; color: string; hours: number; cost: number }>();
    const byWeekday = Array.from({ length: 7 }, () => ({ cost: 0, hours: 0 }));
    const people = new Map<
      string,
      { name: string; hours: number; late: number; noShows: number; weekly: Map<string, number> }
    >();
    let pastShifts = 0;
    let late = 0;
    let lateMinutes = 0;
    let noShows = 0;
    let leftEarly = 0;

    for (const s of shifts) {
      const week = weeks[weekIndex.get(weekOf(s.startsAt)) ?? -1];
      if (!week) continue;
      const hours = paidHours(s);
      const cost = hours * ((s.employee?.hourlyRateCents ?? 0) / 100);
      week.scheduledHours += hours;
      week.scheduledCost += cost;
      week.shifts++;

      const pos = byPosition.get(s.position.id) ?? { name: s.position.name, color: s.position.color, hours: 0, cost: 0 };
      pos.hours += hours;
      pos.cost += cost;
      byPosition.set(s.position.id, pos);

      byWeekday[dayOfWeekOf(localDateOf(s.startsAt, tz))].cost += cost;
      byWeekday[dayOfWeekOf(localDateOf(s.startsAt, tz))].hours += hours;

      const person = people.get(s.employeeId!) ?? {
        name: `${s.employee?.firstName} ${s.employee?.lastName}`,
        hours: 0,
        late: 0,
        noShows: 0,
        weekly: new Map<string, number>(),
      };
      people.set(s.employeeId!, person);

      // Attendance only counts shifts that have finished.
      if (s.endsAt <= now) {
        const a = attendanceFor(s, entriesByShift.get(s.id) ?? [], now);
        pastShifts++;
        if (a.lateMinutes) {
          late++;
          lateMinutes += a.lateMinutes;
          week.late++;
          person.late++;
        }
        if (a.status === 'NO_SHOW') {
          noShows++;
          week.noShows++;
          person.noShows++;
        }
        if (a.leftEarlyMinutes) leftEarly++;
      }
    }

    for (const e of entries) {
      const key = weekOf(e.clockInAt);
      const week = weeks[weekIndex.get(key) ?? -1];
      if (!week) continue;
      const hours = workedMinutes(e, now) / 60;
      week.workedHours += hours;
      week.actualWages += hours * ((e.employee?.hourlyRateCents ?? 0) / 100);
      const person = people.get(e.employeeId);
      if (person) {
        person.hours += hours;
        person.weekly.set(key, (person.weekly.get(key) ?? 0) + hours);
      }
    }

    // ─── Overtime: hours past the weekly threshold, per person per week ──
    let overtimeHours = 0;
    const team = [...people.values()].map((p) => {
      const overtime = [...p.weekly.values()].reduce(
        (sum, h) => sum + Math.max(0, h - OVERTIME_THRESHOLD_HOURS),
        0,
      );
      overtimeHours += overtime;
      return {
        name: p.name,
        hours: round1(p.hours),
        avgWeeklyHours: round1(p.hours / weekCount),
        overtimeHours: round1(overtime),
        late: p.late,
        noShows: p.noShows,
      };
    });

    const totals = weeks.reduce(
      (t, w) => ({
        scheduledHours: t.scheduledHours + w.scheduledHours,
        scheduledCost: t.scheduledCost + w.scheduledCost,
        workedHours: t.workedHours + w.workedHours,
        actualWages: t.actualWages + w.actualWages,
      }),
      { scheduledHours: 0, scheduledCost: 0, workedHours: 0, actualWages: 0 },
    );
    const budget =
      location.weeklyLaborBudgetCents === null ? null : location.weeklyLaborBudgetCents / 100;
    const completed = weeks.filter((w) => w.weekStart !== currentWeek);

    return {
      location: { id: location.id, name: location.name },
      weekCount,
      currentWeek,
      weeklyBudget: budget,
      weeks: weeks.map((w) => ({
        ...w,
        scheduledHours: round1(w.scheduledHours),
        scheduledCost: round2(w.scheduledCost),
        workedHours: round1(w.workedHours),
        actualWages: round2(w.actualWages),
        inProgress: w.weekStart === currentWeek,
      })),
      totals: {
        scheduledHours: round1(totals.scheduledHours),
        scheduledCost: round2(totals.scheduledCost),
        workedHours: round1(totals.workedHours),
        actualWages: round2(totals.actualWages),
        // Averages use completed weeks only; the current week is partial.
        averageWeeklyWages: round2(
          completed.reduce((sum, w) => sum + w.actualWages, 0) / Math.max(1, completed.length),
        ),
        weeksOverBudget: budget === null ? 0 : completed.filter((w) => w.actualWages > budget).length,
        overtimeHours: round1(overtimeHours),
      },
      attendance: {
        shifts: pastShifts,
        late,
        lateRate: pct(late, pastShifts),
        averageLateMinutes: late ? Math.round(lateMinutes / late) : 0,
        noShows,
        noShowRate: pct(noShows, pastShifts),
        leftEarly,
      },
      byPosition: [...byPosition.values()]
        .map((p) => ({ ...p, hours: round1(p.hours), cost: round2(p.cost) }))
        .sort((a, b) => b.hours - a.hours),
      // Average per occurrence of each weekday in the period, Monday first.
      byWeekday: [1, 2, 3, 4, 5, 6, 0].map((d) => ({
        dayOfWeek: d,
        averageCost: round2(byWeekday[d].cost / weekCount),
        averageHours: round1(byWeekday[d].hours / weekCount),
      })),
      team: team.sort((a, b) => b.hours - a.hours),
    };
  }
}
