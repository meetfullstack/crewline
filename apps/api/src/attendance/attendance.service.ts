import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addLocalDays,
  type LocalDate,
  localDateOf,
  localMinutesOf,
  weekStartOf,
  zonedInstant,
} from '../common/time.js';
import type { Prisma } from '../generated/prisma/client.js';
import { EmploymentStatus, ScheduleStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  attendanceFor,
  breakMinutes,
  matchShift,
  onBreak,
  workedMinutes,
} from './attendance.rules.js';
import type { EditEntryDto, ManualEntryDto, TimesheetQuery } from './attendance.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRY_MINUTES = 16 * 60;

const entrySelect = {
  id: true,
  employeeId: true,
  locationId: true,
  shiftId: true,
  clockInAt: true,
  clockOutAt: true,
  editedAt: true,
  editReason: true,
  editedBy: { select: { employee: { select: { firstName: true } } } },
  breaks: { orderBy: { startAt: 'asc' }, select: { startAt: true, endAt: true } },
} satisfies Prisma.TimeEntrySelect;

type EntryRow = Prisma.TimeEntryGetPayload<{ select: typeof entrySelect }>;
type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Staff clock ───────────────────────────────────────────────────────

  /** What the clock card needs: am I on the clock, and what's my next shift? */
  async clockState(organizationId: string, employeeId: string) {
    const now = new Date();
    const [open, candidates] = await Promise.all([
      this.openEntry(employeeId),
      this.shiftsAround(employeeId, now),
    ]);
    const current = open?.shiftId
      ? candidates.find((s) => s.id === open.shiftId)
      : matchShift(candidates, now);
    const next = current ?? candidates.find((s) => s.startsAt > now);

    return {
      now,
      entry: open && {
        id: open.id,
        clockInAt: open.clockInAt,
        onBreak: onBreak(open),
        breakStartedAt: open.breaks.find((b) => b.endAt === null)?.startAt ?? null,
        workedMinutes: Math.round(workedMinutes(open, now)),
        breakMinutes: Math.round(breakMinutes(open, now)),
        unscheduled: !open.shiftId,
      },
      shift: next && this.shiftSummary(next),
      // Clocking in now would attach to this shift (or be unscheduled).
      clockInMatchesShift: Boolean(matchShift(candidates, now)),
    };
  }

  async clockIn(organizationId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId },
      select: { status: true, locations: { take: 1, select: { locationId: true } } },
    });
    if (!employee || employee.status !== EmploymentStatus.ACTIVE) {
      throw new ForbiddenException('Only active staff can clock in');
    }
    if (await this.openEntry(employeeId)) {
      throw new ConflictException('You’re already clocked in');
    }
    const now = new Date();
    const shift = matchShift(await this.shiftsAround(employeeId, now), now);
    const locationId = shift?.locationId ?? employee.locations[0]?.locationId;
    if (!locationId) throw new BadRequestException('You aren’t assigned to a location');

    await this.prisma.timeEntry.create({
      data: { employeeId, locationId, shiftId: shift?.id ?? null, clockInAt: now },
    });
    return this.clockState(organizationId, employeeId);
  }

  async startBreak(organizationId: string, employeeId: string) {
    const open = await this.requireOpen(employeeId);
    if (onBreak(open)) throw new ConflictException('You’re already on a break');
    await this.prisma.timeBreak.create({ data: { timeEntryId: open.id, startAt: new Date() } });
    return this.clockState(organizationId, employeeId);
  }

  async endBreak(organizationId: string, employeeId: string) {
    const open = await this.requireOpen(employeeId);
    const { count } = await this.prisma.timeBreak.updateMany({
      where: { timeEntryId: open.id, endAt: null },
      data: { endAt: new Date() },
    });
    if (count === 0) throw new ConflictException('You’re not on a break');
    return this.clockState(organizationId, employeeId);
  }

  async clockOut(organizationId: string, employeeId: string) {
    const open = await this.requireOpen(employeeId);
    const now = new Date();
    await this.prisma.$transaction([
      // Clocking out also ends a break someone forgot to end.
      this.prisma.timeBreak.updateMany({
        where: { timeEntryId: open.id, endAt: null },
        data: { endAt: now },
      }),
      this.prisma.timeEntry.update({ where: { id: open.id }, data: { clockOutAt: now } }),
    ]);
    const worked = workedMinutes({ ...open, clockOutAt: now }, now);
    return { ...(await this.clockState(organizationId, employeeId)), lastWorkedMinutes: Math.round(worked) };
  }

  // ─── Manager timesheet ─────────────────────────────────────────────────

  async timesheet(organizationId: string, query: TimesheetQuery) {
    const location = await this.location(organizationId, query.locationId);
    const tz = location.timezone;
    const weekStart = this.weekOf(location, query.weekStart);
    const days = Array.from({ length: 7 }, (_, i) => addLocalDays(weekStart, i));
    const from = zonedInstant(weekStart, 0, tz);
    const to = zonedInstant(addLocalDays(weekStart, 7), 0, tz);
    const now = new Date();

    const [shifts, entries, employees] = await Promise.all([
      this.prisma.shift.findMany({
        where: {
          locationId: location.id,
          employeeId: { not: null },
          startsAt: { gte: from, lt: to },
          schedule: { status: ScheduleStatus.PUBLISHED },
        },
        orderBy: { startsAt: 'asc' },
        select: {
          id: true,
          employeeId: true,
          startsAt: true,
          endsAt: true,
          breakMinutes: true,
          position: { select: { name: true, color: true } },
        },
      }),
      this.prisma.timeEntry.findMany({
        where: { locationId: location.id, clockInAt: { gte: from, lt: to } },
        orderBy: { clockInAt: 'asc' },
        select: entrySelect,
      }),
      this.prisma.employee.findMany({
        where: {
          organizationId,
          OR: [
            { locations: { some: { locationId: location.id } }, status: { not: EmploymentStatus.TERMINATED } },
            { timeEntries: { some: { locationId: location.id, clockInAt: { gte: from, lt: to } } } },
          ],
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: { id: true, firstName: true, lastName: true, hourlyRateCents: true },
      }),
    ]);

    const entriesFor = (shiftId: string) => entries.filter((e) => e.shiftId === shiftId);

    const rows = employees.map((employee) => {
      const myShifts = shifts.filter((s) => s.employeeId === employee.id);
      const myEntries = entries.filter((e) => e.employeeId === employee.id);
      const shiftViews = myShifts.map((s) => ({
        id: s.id,
        date: localDateOf(s.startsAt, tz),
        startMinute: localMinutesOf(s.startsAt, tz),
        endMinute: localMinutesOf(s.startsAt, tz) + Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000),
        position: s.position,
        attendance: attendanceFor(s, entriesFor(s.id), now),
      }));
      const entryViews = myEntries.map((e) => this.entryView(e, tz, now));

      const worked = myEntries.reduce((sum, e) => sum + workedMinutes(e, now), 0);
      const scheduled = shiftViews.reduce((sum, s) => sum + s.attendance.scheduledMinutes, 0);
      // Variance only counts what's settled: finished shifts (and no-shows)
      // plus unscheduled work. Upcoming shifts aren't "missed" hours yet.
      const variance =
        shiftViews.reduce((sum, s) => sum + s.attendance.varianceMinutes, 0) +
        entryViews.filter((e) => !e.shiftId).reduce((sum, e) => sum + e.workedMinutes, 0);
      const count = (status: string) => shiftViews.filter((s) => s.attendance.status === status).length;
      return {
        employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName },
        shifts: shiftViews,
        entries: entryViews,
        totals: {
          scheduledHours: round1(scheduled / 60),
          workedHours: round1(worked / 60),
          varianceHours: round1(variance / 60),
          wages: Math.round((worked / 60) * employee.hourlyRateCents) / 100,
          late: shiftViews.filter((s) => s.attendance.lateMinutes > 0).length,
          noShows: count('NO_SHOW'),
          missingClockOuts: count('MISSING_CLOCK_OUT'),
          leftEarly: shiftViews.filter((s) => s.attendance.leftEarlyMinutes > 0).length,
          unscheduled: entryViews.filter((e) => !e.shiftId).length,
        },
      };
    }).filter((r) => r.shifts.length > 0 || r.entries.length > 0);

    const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + pick(r), 0);
    return {
      location,
      weekStart,
      days,
      rows,
      totals: {
        scheduledHours: round1(sum((r) => r.totals.scheduledHours)),
        workedHours: round1(sum((r) => r.totals.workedHours)),
        varianceHours: round1(sum((r) => r.totals.varianceHours)),
        wages: Math.round(sum((r) => r.totals.wages) * 100) / 100,
        late: sum((r) => r.totals.late),
        noShows: sum((r) => r.totals.noShows),
        missingClockOuts: sum((r) => r.totals.missingClockOuts),
      },
    };
  }

  async createEntry(organizationId: string, editorUserId: string, dto: ManualEntryDto) {
    const location = await this.location(organizationId, dto.locationId);
    const employee = await this.prisma.employee.count({ where: { id: dto.employeeId, organizationId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const times = this.instants(location.timezone, dto);
    const shift = matchShift(await this.shiftsAround(dto.employeeId, times.clockInAt), times.clockInAt);
    await this.assertNoOverlap(dto.employeeId, times.clockInAt, times.clockOutAt);

    const entry = await this.prisma.timeEntry.create({
      data: {
        employeeId: dto.employeeId,
        locationId: location.id,
        shiftId: shift?.id ?? null,
        clockInAt: times.clockInAt,
        clockOutAt: times.clockOutAt,
        editedById: editorUserId,
        editedAt: new Date(),
        editReason: dto.reason.trim(),
        breaks: { create: this.syntheticBreak(times, dto.breakMinutes) },
      },
      select: entrySelect,
    });
    return this.entryView(entry, location.timezone, new Date());
  }

  async editEntry(organizationId: string, editorUserId: string, id: string, dto: EditEntryDto) {
    const existing = await this.prisma.timeEntry.findFirst({
      where: { id, location: { organizationId } },
      select: { employeeId: true, location: { select: { timezone: true } } },
    });
    if (!existing) throw new NotFoundException('Time entry not found');

    const times = this.instants(existing.location.timezone, dto);
    await this.assertNoOverlap(existing.employeeId, times.clockInAt, times.clockOutAt, id);
    const shift = matchShift(
      await this.shiftsAround(existing.employeeId, times.clockInAt),
      times.clockInAt,
    );

    const entry = await this.prisma.$transaction(async (tx) => {
      if (dto.breakMinutes !== undefined) {
        await tx.timeBreak.deleteMany({ where: { timeEntryId: id } });
        await tx.timeBreak.createMany({
          data: this.syntheticBreak(times, dto.breakMinutes).map((b) => ({ ...b, timeEntryId: id })),
        });
      }
      return tx.timeEntry.update({
        where: { id },
        data: {
          clockInAt: times.clockInAt,
          clockOutAt: times.clockOutAt,
          shiftId: shift?.id ?? null,
          editedById: editorUserId,
          editedAt: new Date(),
          editReason: dto.reason.trim(),
        },
        select: entrySelect,
      });
    });
    return this.entryView(entry, existing.location.timezone, new Date());
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private openEntry(employeeId: string) {
    return this.prisma.timeEntry.findFirst({
      where: { employeeId, clockOutAt: null },
      orderBy: { clockInAt: 'desc' },
      select: entrySelect,
    });
  }

  private async requireOpen(employeeId: string) {
    const open = await this.openEntry(employeeId);
    if (!open) throw new ConflictException('You’re not clocked in');
    return open;
  }

  /** Published shifts from a day before to a day after `at`. */
  private shiftsAround(employeeId: string, at: Date) {
    return this.prisma.shift.findMany({
      where: {
        employeeId,
        schedule: { status: ScheduleStatus.PUBLISHED },
        startsAt: { lt: new Date(at.getTime() + DAY_MS) },
        endsAt: { gt: new Date(at.getTime() - DAY_MS) },
      },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        locationId: true,
        startsAt: true,
        endsAt: true,
        breakMinutes: true,
        position: { select: { name: true, color: true } },
        location: { select: { name: true, timezone: true } },
      },
    });
  }

  private shiftSummary(s: Awaited<ReturnType<AttendanceService['shiftsAround']>>[number]) {
    const tz = s.location.timezone;
    const startMinute = localMinutesOf(s.startsAt, tz);
    return {
      id: s.id,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      date: localDateOf(s.startsAt, tz),
      startMinute,
      endMinute: startMinute + Math.round((s.endsAt.getTime() - s.startsAt.getTime()) / 60_000),
      position: s.position,
      location: { name: s.location.name },
    };
  }

  private entryView(e: EntryRow, tz: string, now: Date) {
    const date = localDateOf(e.clockInAt, tz);
    const inMinute = localMinutesOf(e.clockInAt, tz);
    return {
      id: e.id,
      shiftId: e.shiftId,
      date,
      clockInAt: e.clockInAt,
      clockOutAt: e.clockOutAt,
      clockInMinute: inMinute,
      clockOutMinute: e.clockOutAt
        ? inMinute + Math.round((e.clockOutAt.getTime() - e.clockInAt.getTime()) / 60_000)
        : null,
      breakMinutes: Math.round(breakMinutes(e, now)),
      workedMinutes: Math.round(workedMinutes(e, now)),
      edited: e.editedAt
        ? { at: e.editedAt, reason: e.editReason, by: e.editedBy?.employee?.firstName ?? null }
        : null,
    };
  }

  private instants(
    timeZone: string,
    input: { date: LocalDate; clockInMinute: number; clockOutMinute: number },
  ) {
    const length = input.clockOutMinute - input.clockInMinute;
    if (length <= 0) throw new BadRequestException('Clock-out must be after clock-in');
    if (length > MAX_ENTRY_MINUTES) throw new BadRequestException('Entries can be at most 16 hours');
    const clockInAt = zonedInstant(input.date, input.clockInMinute, timeZone);
    const outDate = addLocalDays(input.date, Math.floor(input.clockOutMinute / 1440));
    const clockOutAt = zonedInstant(outDate, input.clockOutMinute % 1440, timeZone);
    if (clockOutAt > new Date()) throw new BadRequestException('Entries can’t end in the future');
    return { clockInAt, clockOutAt };
  }

  /** Manual entries record break time as one block in the middle of the shift. */
  private syntheticBreak(times: { clockInAt: Date; clockOutAt: Date }, minutes = 0) {
    if (!minutes) return [];
    const length = times.clockOutAt.getTime() - times.clockInAt.getTime();
    if (minutes * 60_000 >= length) throw new BadRequestException('Break must be shorter than the entry');
    const startAt = new Date(times.clockInAt.getTime() + (length - minutes * 60_000) / 2);
    return [{ startAt, endAt: new Date(startAt.getTime() + minutes * 60_000) }];
  }

  private async assertNoOverlap(employeeId: string, from: Date, to: Date, exceptId?: string) {
    const clash = await this.prisma.timeEntry.findFirst({
      where: {
        employeeId,
        id: exceptId ? { not: exceptId } : undefined,
        clockInAt: { lt: to },
        OR: [{ clockOutAt: null }, { clockOutAt: { gt: from } }],
      },
    });
    if (clash) throw new ConflictException('This overlaps another time entry for the same person');
  }

  private async location(organizationId: string, id: string) {
    const location = await this.prisma.location.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, timezone: true, weekStartsOn: true },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  private weekOf(location: { timezone: string; weekStartsOn: number }, date?: string) {
    const anchor = date ? zonedInstant(date, 12 * 60, location.timezone) : new Date();
    return weekStartOf(anchor, location.timezone, location.weekStartsOn as WeekDay);
  }
}
