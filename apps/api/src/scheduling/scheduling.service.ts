import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  addLocalDays,
  dateColumn,
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
  type Conflict,
  type EmployeeContext,
  findConflicts,
  paidHours,
  type ShiftLike,
} from './conflicts.js';
import type {
  CopyWeekDto,
  ShiftInputDto,
  UpdateShiftDto,
  WeekQuery,
} from './scheduling.dto.js';

type Tx = Prisma.TransactionClient;
type LocationRow = { id: string; name: string; timezone: string; weekStartsOn: number };
type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const MAX_SHIFT_MINUTES = 16 * 60;
const DAY_MS = 24 * 60 * 60 * 1000;

const shiftSelect = {
  id: true,
  scheduleId: true,
  locationId: true,
  positionId: true,
  employeeId: true,
  startsAt: true,
  endsAt: true,
  breakMinutes: true,
  notes: true,
} satisfies Prisma.ShiftSelect;
type ShiftRow = Prisma.ShiftGetPayload<{ select: typeof shiftSelect }>;

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Reading a week ────────────────────────────────────────────────────

  async getWeek(organizationId: string, query: WeekQuery) {
    const location = await this.location(organizationId, query.locationId);
    const tz = location.timezone;
    const weekStart = this.weekOf(location, query.weekStart);
    const weekEnd = addLocalDays(weekStart, 6);
    const days = Array.from({ length: 7 }, (_, i) => addLocalDays(weekStart, i));

    const schedule = await this.prisma.schedule.findUnique({
      where: {
        locationId_weekStart: {
          locationId: location.id,
          weekStart: dateColumn(weekStart),
        },
      },
    });
    const shifts = schedule
      ? await this.prisma.shift.findMany({
          where: { scheduleId: schedule.id },
          orderBy: { startsAt: 'asc' },
          select: shiftSelect,
        })
      : [];

    const assignedIds = [
      ...new Set(shifts.map((s) => s.employeeId).filter((id): id is string => !!id)),
    ];
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        OR: [
          {
            status: { not: EmploymentStatus.TERMINATED },
            locations: { some: { locationId: location.id } },
          },
          { id: { in: assignedIds } },
        ],
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      select: this.employeeSelect(weekStart, weekEnd),
    });

    const contexts = await this.contextsFor(
      employees,
      zonedInstant(weekStart, 0, tz),
      zonedInstant(addLocalDays(weekStart, 7), 0, tz),
    );
    const positions = await this.prisma.position.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    });
    const positionName = new Map(positions.map((p) => [p.id, p.name]));
    const rate = new Map(employees.map((e) => [e.id, e.hourlyRateCents / 100]));

    const shiftViews = shifts.map((shift) => {
      const ctx = shift.employeeId ? contexts.get(shift.employeeId) : undefined;
      const conflicts = ctx
        ? findConflicts(shift, {
            ...ctx,
            timeZone: tz,
            weekStart,
            positionName: positionName.get(shift.positionId),
          })
        : [];
      return this.view(shift, tz, rate.get(shift.employeeId ?? ''), conflicts);
    });

    const byDay = days.map((date) => {
      const dayShifts = shiftViews.filter((s) => s.date === date);
      return {
        date,
        hours: round2(dayShifts.reduce((sum, s) => sum + s.paidHours, 0)),
        cost: round2(dayShifts.reduce((sum, s) => sum + s.cost, 0)),
      };
    });
    const all = shiftViews.flatMap((s) => s.conflicts);

    return {
      location,
      weekStart,
      days,
      schedule: schedule && {
        id: schedule.id,
        status: schedule.status,
        publishedAt: schedule.publishedAt,
        hasUnpublishedChanges:
          schedule.status === ScheduleStatus.PUBLISHED &&
          !!schedule.publishedAt &&
          schedule.updatedAt.getTime() - schedule.publishedAt.getTime() > 1000,
      },
      positions,
      employees: employees.map((e) => ({
        id: e.id,
        firstName: e.firstName,
        lastName: e.lastName,
        status: e.status,
        hourlyRate: e.hourlyRateCents / 100,
        maxWeeklyHours: e.maxWeeklyHours,
        positions: e.positions.map((p) => ({
          id: p.positionId,
          isPrimary: p.isPrimary,
        })),
        availability: e.availability,
        timeOff: e.timeOff.map((t) => ({
          id: t.id,
          type: t.type,
          status: t.status,
          startDate: t.startDate.toISOString().slice(0, 10),
          endDate: t.endDate.toISOString().slice(0, 10),
        })),
      })),
      shifts: shiftViews,
      summary: {
        totalHours: round2(byDay.reduce((sum, d) => sum + d.hours, 0)),
        laborCost: round2(byDay.reduce((sum, d) => sum + d.cost, 0)),
        openShifts: shiftViews.filter((s) => !s.employeeId).length,
        errors: all.filter((c) => c.severity === 'error').length,
        warnings: all.filter((c) => c.severity === 'warning').length,
        byDay,
      },
    };
  }

  // ─── Writing shifts ────────────────────────────────────────────────────

  async createShift(organizationId: string, dto: ShiftInputDto) {
    const location = await this.location(organizationId, dto.locationId);
    await this.assertRefs(organizationId, dto.positionId, dto.employeeId);
    const times = this.toInstants(location, dto);

    const shift = await this.prisma.$transaction(async (tx) => {
      const scheduleId = await this.scheduleFor(tx, location, dto.date);
      const created = await tx.shift.create({
        data: {
          scheduleId,
          locationId: location.id,
          positionId: dto.positionId,
          employeeId: dto.employeeId ?? null,
          ...times,
          notes: dto.notes?.trim() || null,
        },
        select: shiftSelect,
      });
      await this.touch(tx, scheduleId);
      return created;
    });
    return this.viewWithConflicts(organizationId, location, shift);
  }

  async updateShift(organizationId: string, id: string, dto: UpdateShiftDto) {
    const existing = await this.findShift(organizationId, id);
    const location = await this.location(organizationId, existing.locationId);
    if (dto.locationId && dto.locationId !== existing.locationId) {
      throw new BadRequestException('Shifts can’t be moved between locations');
    }
    const tz = location.timezone;
    const current = this.localFields(existing, tz);
    const merged = {
      positionId: dto.positionId ?? existing.positionId,
      employeeId: dto.employeeId === undefined ? existing.employeeId : dto.employeeId,
      date: dto.date ?? current.date,
      startMinute: dto.startMinute ?? current.startMinute,
      endMinute: dto.endMinute ?? current.endMinute,
      breakMinutes: dto.breakMinutes ?? existing.breakMinutes,
      notes: dto.notes === undefined ? existing.notes : dto.notes?.trim() || null,
    };
    // Moving a shift by date alone keeps its length.
    if (dto.date && dto.startMinute === undefined && dto.endMinute === undefined) {
      merged.endMinute = current.endMinute;
    }
    await this.assertRefs(organizationId, merged.positionId, merged.employeeId);
    const times = this.toInstants(location, merged);

    const shift = await this.prisma.$transaction(async (tx) => {
      const scheduleId = await this.scheduleFor(tx, location, merged.date);
      const updated = await tx.shift.update({
        where: { id },
        data: {
          scheduleId,
          positionId: merged.positionId,
          employeeId: merged.employeeId,
          notes: merged.notes,
          ...times,
        },
        select: shiftSelect,
      });
      await this.touch(tx, existing.scheduleId);
      if (scheduleId !== existing.scheduleId) await this.touch(tx, scheduleId);
      return updated;
    });
    return this.viewWithConflicts(organizationId, location, shift);
  }

  async deleteShift(organizationId: string, id: string) {
    const existing = await this.findShift(organizationId, id);
    await this.prisma.$transaction(async (tx) => {
      await tx.shift.delete({ where: { id } });
      await this.touch(tx, existing.scheduleId);
    });
  }

  /** Dry run: what would be flagged if this shift were saved? */
  async checkShift(
    organizationId: string,
    dto: ShiftInputDto & { shiftId?: string },
  ): Promise<Conflict[]> {
    const location = await this.location(organizationId, dto.locationId);
    if (!dto.employeeId) return [];
    await this.assertRefs(organizationId, dto.positionId, dto.employeeId);
    const times = this.toInstants(location, dto);
    return this.conflictsFor(organizationId, location, {
      id: dto.shiftId,
      employeeId: dto.employeeId,
      positionId: dto.positionId,
      ...times,
    });
  }

  // ─── Whole-week actions ────────────────────────────────────────────────

  async copyWeek(organizationId: string, dto: CopyWeekDto) {
    const location = await this.location(organizationId, dto.locationId);
    const from = this.weekOf(location, dto.fromWeekStart);
    const to = this.weekOf(location, dto.toWeekStart);
    if (from === to) throw new BadRequestException('Pick a different week to copy into');

    const source = await this.prisma.schedule.findUnique({
      where: {
        locationId_weekStart: { locationId: location.id, weekStart: dateColumn(from) },
      },
      include: {
        shifts: {
          select: {
            ...shiftSelect,
            employee: { select: { status: true } },
          },
        },
      },
    });
    if (!source || source.shifts.length === 0) {
      throw new BadRequestException('There are no shifts in that week to copy');
    }

    const offsetDays = Math.round(
      (dateColumn(to).getTime() - dateColumn(from).getTime()) / DAY_MS,
    );
    const tz = location.timezone;

    return this.prisma.$transaction(async (tx) => {
      const scheduleId = await this.scheduleFor(tx, location, to);
      if (dto.mode === 'replace') {
        await tx.shift.deleteMany({ where: { scheduleId } });
      }
      let reassignedToOpen = 0;
      const data = source.shifts.map((s) => {
        // Re-anchor on the local wall clock so DST changes don't shift times.
        const local = this.localFields(s, tz);
        const times = this.toInstants(location, {
          ...local,
          date: addLocalDays(local.date, offsetDays),
          breakMinutes: s.breakMinutes,
        });
        const stillEmployed = s.employee?.status === EmploymentStatus.ACTIVE;
        if (s.employeeId && !stillEmployed) reassignedToOpen++;
        return {
          scheduleId,
          locationId: location.id,
          positionId: s.positionId,
          employeeId: stillEmployed ? s.employeeId : null,
          notes: s.notes,
          ...times,
        };
      });
      await tx.shift.createMany({ data });
      await this.touch(tx, scheduleId);
      return { copied: data.length, reassignedToOpen };
    });
  }

  async publish(organizationId: string, locationId: string, weekStartParam: string) {
    const week = await this.getWeek(organizationId, {
      locationId,
      weekStart: weekStartParam,
    });
    if (!week.schedule || week.shifts.length === 0) {
      throw new BadRequestException('Add some shifts before publishing');
    }
    if (week.summary.errors > 0) {
      throw new ConflictException(
        `Resolve ${week.summary.errors} scheduling error${week.summary.errors > 1 ? 's' : ''} before publishing`,
      );
    }
    const now = new Date();
    await this.prisma.schedule.update({
      where: { id: week.schedule.id },
      data: { status: ScheduleStatus.PUBLISHED, publishedAt: now, updatedAt: now },
    });
    return { publishedAt: now, shifts: week.shifts.length };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private async location(organizationId: string, id: string): Promise<LocationRow> {
    const location = await this.prisma.location.findFirst({
      where: { id, organizationId },
      select: { id: true, name: true, timezone: true, weekStartsOn: true },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  /** Normalises any date in a week to that week's first local day. */
  private weekOf(location: LocationRow, date?: string): LocalDate {
    const tz = location.timezone;
    const anchor = date ? zonedInstant(date, 12 * 60, tz) : new Date();
    return weekStartOf(anchor, tz, location.weekStartsOn as WeekDay);
  }

  private async scheduleFor(tx: Tx, location: LocationRow, date: LocalDate) {
    const weekStart = dateColumn(this.weekOf(location, date));
    const schedule = await tx.schedule.upsert({
      where: { locationId_weekStart: { locationId: location.id, weekStart } },
      create: { locationId: location.id, weekStart },
      update: {},
      select: { id: true },
    });
    return schedule.id;
  }

  /** Marks the week as edited, so a published week shows "unpublished changes". */
  private touch(tx: Tx, scheduleId: string) {
    return tx.schedule.update({
      where: { id: scheduleId },
      data: { updatedAt: new Date() },
    });
  }

  private toInstants(
    location: LocationRow,
    input: { date: string; startMinute: number; endMinute: number; breakMinutes?: number },
  ) {
    const length = input.endMinute - input.startMinute;
    if (length <= 0) throw new BadRequestException('Shift must end after it starts');
    if (length > MAX_SHIFT_MINUTES) {
      throw new BadRequestException('Shifts can be at most 16 hours long');
    }
    const breakMinutes = input.breakMinutes ?? 0;
    if (breakMinutes >= length) {
      throw new BadRequestException('Break must be shorter than the shift');
    }
    const startsAt = zonedInstant(input.date, input.startMinute, location.timezone);
    // Build the end from the local calendar so overnight shifts across a DST
    // change still end at the right wall-clock time.
    const endDate = addLocalDays(input.date, Math.floor(input.endMinute / 1440));
    const endsAt = zonedInstant(endDate, input.endMinute % 1440, location.timezone);
    return { startsAt, endsAt, breakMinutes };
  }

  private localFields(shift: Pick<ShiftRow, 'startsAt' | 'endsAt'>, tz: string) {
    const date = localDateOf(shift.startsAt, tz);
    const startMinute = localMinutesOf(shift.startsAt, tz);
    const endDate = localDateOf(shift.endsAt, tz);
    const daysLater = Math.round(
      (dateColumn(endDate).getTime() - dateColumn(date).getTime()) / DAY_MS,
    );
    const endMinute = daysLater * 1440 + localMinutesOf(shift.endsAt, tz);
    return { date, startMinute, endMinute };
  }

  private view(shift: ShiftRow, tz: string, hourlyRate = 0, conflicts: Conflict[] = []) {
    const hours = paidHours(shift);
    return {
      ...shift,
      ...this.localFields(shift, tz),
      paidHours: round2(hours),
      cost: shift.employeeId ? round2(hours * hourlyRate) : 0,
      conflicts,
    };
  }

  private async viewWithConflicts(
    organizationId: string,
    location: LocationRow,
    shift: ShiftRow,
  ) {
    const rate = shift.employeeId
      ? (
          await this.prisma.employee.findUnique({
            where: { id: shift.employeeId },
            select: { hourlyRateCents: true },
          })
        )?.hourlyRateCents
      : 0;
    const conflicts = await this.conflictsFor(organizationId, location, shift);
    return this.view(shift, location.timezone, (rate ?? 0) / 100, conflicts);
  }

  private async conflictsFor(
    organizationId: string,
    location: LocationRow,
    shift: ShiftLike,
  ): Promise<Conflict[]> {
    if (!shift.employeeId) return [];
    const tz = location.timezone;
    const weekStart = this.weekOf(location, localDateOf(shift.startsAt, tz));
    const employees = await this.prisma.employee.findMany({
      where: { id: shift.employeeId, organizationId },
      select: this.employeeSelect(weekStart, addLocalDays(weekStart, 6)),
    });
    const contexts = await this.contextsFor(
      employees,
      zonedInstant(weekStart, 0, tz),
      zonedInstant(addLocalDays(weekStart, 7), 0, tz),
    );
    const ctx = contexts.get(shift.employeeId);
    if (!ctx) return [];
    const position = await this.prisma.position.findUnique({
      where: { id: shift.positionId },
      select: { name: true },
    });
    return findConflicts(shift, {
      ...ctx,
      timeZone: tz,
      weekStart,
      positionName: position?.name,
    });
  }

  private employeeSelect(weekStart: LocalDate, weekEnd: LocalDate) {
    return {
      id: true,
      firstName: true,
      lastName: true,
      status: true,
      hourlyRateCents: true,
      maxWeeklyHours: true,
      positions: {
        orderBy: { isPrimary: 'desc' as const },
        select: { positionId: true, isPrimary: true },
      },
      availability: {
        select: { dayOfWeek: true, startMinute: true, endMinute: true, kind: true },
      },
      // A day of slack either side catches overnight shifts at the edges.
      timeOff: {
        where: {
          status: { in: ['PENDING' as const, 'APPROVED' as const] },
          startDate: { lte: dateColumn(addLocalDays(weekEnd, 1)) },
          endDate: { gte: dateColumn(addLocalDays(weekStart, -1)) },
        },
        select: { id: true, type: true, status: true, startDate: true, endDate: true },
      },
    } satisfies Prisma.EmployeeSelect;
  }

  /**
   * Builds the rules-engine context for each employee: profile, time off and
   * every shift they work across all locations from a day before the week to
   * a day after (for rest-period checks).
   */
  private async contextsFor(
    employees: Prisma.EmployeeGetPayload<{
      select: ReturnType<SchedulingService['employeeSelect']>;
    }>[],
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    const ids = employees.map((e) => e.id);
    const nearby = ids.length
      ? await this.prisma.shift.findMany({
          where: {
            employeeId: { in: ids },
            startsAt: { lt: new Date(rangeEnd.getTime() + DAY_MS) },
            endsAt: { gt: new Date(rangeStart.getTime() - DAY_MS) },
          },
          select: shiftSelect,
        })
      : [];

    const contexts = new Map<string, { employee: EmployeeContext; otherShifts: ShiftLike[] }>();
    for (const e of employees) {
      contexts.set(e.id, {
        employee: {
          id: e.id,
          firstName: e.firstName,
          status: e.status,
          positionIds: e.positions.map((p) => p.positionId),
          maxWeeklyHours: e.maxWeeklyHours,
          availability: e.availability,
          timeOff: e.timeOff.map((t) => ({
            status: t.status,
            startDate: t.startDate.toISOString().slice(0, 10),
            endDate: t.endDate.toISOString().slice(0, 10),
          })),
        },
        otherShifts: nearby.filter((s) => s.employeeId === e.id),
      });
    }
    return contexts;
  }

  private async findShift(organizationId: string, id: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id, location: { organizationId } },
      select: shiftSelect,
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  private async assertRefs(
    organizationId: string,
    positionId: string,
    employeeId?: string | null,
  ) {
    const [position, employee] = await Promise.all([
      this.prisma.position.count({ where: { id: positionId, organizationId } }),
      employeeId
        ? this.prisma.employee.count({ where: { id: employeeId, organizationId } })
        : Promise.resolve(1),
    ]);
    if (!position) throw new BadRequestException('Unknown position');
    if (!employee) throw new BadRequestException('Unknown employee');
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
