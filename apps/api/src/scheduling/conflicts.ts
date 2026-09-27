import {
  addLocalDays,
  type LocalDate,
  localDateOf,
  localMinutesOf,
} from '../common/time.js';

/**
 * The scheduling rules engine. Pure functions only: given a shift and what
 * we know about the employee, list everything a manager should know before
 * booking it. Nothing here blocks a save — restaurants run on judgement
 * calls — but errors do block publishing.
 */

export type ConflictCode =
  | 'INACTIVE'
  | 'OVERLAP'
  | 'TIME_OFF'
  | 'TIME_OFF_PENDING'
  | 'UNAVAILABLE'
  | 'SHORT_REST'
  | 'MAX_HOURS'
  | 'OVERTIME'
  | 'NOT_QUALIFIED';

export type Severity = 'error' | 'warning';

export interface Conflict {
  code: ConflictCode;
  severity: Severity;
  message: string;
}

export interface ShiftLike {
  id?: string;
  employeeId: string | null;
  positionId: string;
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
}

export interface EmployeeContext {
  id: string;
  firstName: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  positionIds: string[];
  maxWeeklyHours: number | null;
  availability: {
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    kind: 'AVAILABLE' | 'PREFERRED' | 'UNAVAILABLE';
  }[];
  timeOff: {
    startDate: LocalDate;
    endDate: LocalDate;
    status: 'PENDING' | 'APPROVED' | 'DENIED' | 'CANCELLED';
  }[];
}

export interface ConflictContext {
  employee: EmployeeContext;
  /** The employee's other shifts around this one (any location). */
  otherShifts: ShiftLike[];
  timeZone: string;
  /** First local day of the scheduling week being built. */
  weekStart: LocalDate;
  positionName?: string;
}

/** Hours worked per week before overtime applies (Ontario ESA). */
export const OVERTIME_THRESHOLD_HOURS = 44;
/** Minimum rest between shifts before we flag a "clopen". */
export const MIN_REST_HOURS = 8;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function paidHours(shift: Pick<ShiftLike, 'startsAt' | 'endsAt' | 'breakMinutes'>) {
  const minutes =
    (shift.endsAt.getTime() - shift.startsAt.getTime()) / MINUTE -
    shift.breakMinutes;
  return Math.max(minutes, 0) / 60;
}

const overlaps = (a: ShiftLike, b: ShiftLike) =>
  a.startsAt < b.endsAt && b.startsAt < a.endsAt;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Splits a shift into per-local-day pieces: [date, weekday, from, to]. */
export function localSegments(
  shift: Pick<ShiftLike, 'startsAt' | 'endsAt'>,
  timeZone: string,
) {
  const segments: { date: LocalDate; dayOfWeek: number; from: number; to: number }[] = [];
  let date = localDateOf(shift.startsAt, timeZone);
  let from = localMinutesOf(shift.startsAt, timeZone);
  let remaining = (shift.endsAt.getTime() - shift.startsAt.getTime()) / MINUTE;

  while (remaining > 0) {
    const span = Math.min(remaining, 1440 - from);
    const [y, m, d] = date.split('-').map(Number);
    segments.push({
      date,
      dayOfWeek: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
      from,
      to: from + span,
    });
    remaining -= span;
    date = addLocalDays(date, 1);
    from = 0;
  }
  return segments;
}

export function findConflicts(shift: ShiftLike, ctx: ConflictContext): Conflict[] {
  if (!shift.employeeId) return [];

  const { employee, timeZone } = ctx;
  // When editing, the shift's own saved copy must not conflict with itself.
  const others = shift.id
    ? ctx.otherShifts.filter((s) => s.id !== shift.id)
    : ctx.otherShifts;
  const conflicts: Conflict[] = [];
  const name = employee.firstName;

  if (employee.status !== 'ACTIVE') {
    conflicts.push({
      code: 'INACTIVE',
      severity: 'error',
      message: `${name} is ${employee.status === 'ON_LEAVE' ? 'on leave' : 'no longer employed'}`,
    });
  }

  const clash = others.find((other) => overlaps(shift, other));
  if (clash) {
    conflicts.push({
      code: 'OVERLAP',
      severity: 'error',
      message: `${name} is already working ${formatRange(clash, timeZone)}`,
    });
  }

  const segments = localSegments(shift, timeZone);

  for (const request of employee.timeOff) {
    if (request.status !== 'APPROVED' && request.status !== 'PENDING') continue;
    const hit = segments.some(
      (s) => s.date >= request.startDate && s.date <= request.endDate,
    );
    if (!hit) continue;
    conflicts.push(
      request.status === 'APPROVED'
        ? { code: 'TIME_OFF', severity: 'error', message: `${name} has approved time off` }
        : {
            code: 'TIME_OFF_PENDING',
            severity: 'warning',
            message: `${name} has a pending time-off request`,
          },
    );
    break;
  }

  const unavailable = employee.availability.find(
    (block) =>
      block.kind === 'UNAVAILABLE' &&
      segments.some(
        (s) =>
          s.dayOfWeek === block.dayOfWeek &&
          s.from < block.endMinute &&
          block.startMinute < s.to,
      ),
  );
  if (unavailable) {
    const day = DAY_NAMES[unavailable.dayOfWeek];
    const allDay = unavailable.startMinute === 0 && unavailable.endMinute >= 1440;
    conflicts.push({
      code: 'UNAVAILABLE',
      severity: 'warning',
      message: allDay
        ? `${name} is unavailable all day ${day}`
        : `${name} is unavailable ${day} ${clock(unavailable.startMinute)}–${clock(unavailable.endMinute)}`,
    });
  }

  if (!clash) {
    // Only overnight turnarounds count: a lunch-and-dinner split shift on the
    // same day is normal in restaurants and not a rest problem.
    const shiftDay = localDateOf(shift.startsAt, timeZone);
    const tightest = others
      .filter((other) => localDateOf(other.startsAt, timeZone) !== shiftDay)
      .map((other) =>
        other.endsAt <= shift.startsAt
          ? shift.startsAt.getTime() - other.endsAt.getTime()
          : other.startsAt.getTime() - shift.endsAt.getTime(),
      )
      .filter((gap) => gap >= 0)
      .sort((a, b) => a - b)[0];
    if (tightest !== undefined && tightest < MIN_REST_HOURS * HOUR) {
      conflicts.push({
        code: 'SHORT_REST',
        severity: 'warning',
        message: `Only ${round1(tightest / HOUR)}h rest between shifts`,
      });
    }
  }

  const weekEnd = addLocalDays(ctx.weekStart, 6);
  const inWeek = (s: ShiftLike) => {
    const day = localDateOf(s.startsAt, timeZone);
    return day >= ctx.weekStart && day <= weekEnd;
  };
  if (inWeek(shift)) {
    // Count hours up to and including this shift, so only the shifts that
    // actually push someone over a limit get flagged — not their whole week.
    const earlier = (s: ShiftLike) =>
      s.startsAt < shift.startsAt ||
      (s.startsAt.getTime() === shift.startsAt.getTime() &&
        (s.id ?? '') < (shift.id ?? '￿'));
    const weekHours =
      others
        .filter((s) => inWeek(s) && earlier(s))
        .reduce((sum, s) => sum + paidHours(s), 0) + paidHours(shift);
    if (employee.maxWeeklyHours !== null && weekHours > employee.maxWeeklyHours) {
      conflicts.push({
        code: 'MAX_HOURS',
        severity: 'warning',
        message: `${round1(weekHours)}h this week — over ${name}'s ${employee.maxWeeklyHours}h limit`,
      });
    }
    if (weekHours > OVERTIME_THRESHOLD_HOURS) {
      conflicts.push({
        code: 'OVERTIME',
        severity: 'warning',
        message: `${round1(weekHours - OVERTIME_THRESHOLD_HOURS)}h of overtime this week`,
      });
    }
  }

  if (!employee.positionIds.includes(shift.positionId)) {
    conflicts.push({
      code: 'NOT_QUALIFIED',
      severity: 'warning',
      message: `${name} isn't trained as ${ctx.positionName ?? 'this position'}`,
    });
  }

  return conflicts;
}

function clock(minutes: number) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h24 < 12 ? 'am' : 'pm'}`;
}

function formatRange(shift: ShiftLike, timeZone: string) {
  const [first] = localSegments(shift, timeZone);
  const end = localMinutesOf(shift.endsAt, timeZone);
  return `${DAY_NAMES[first.dayOfWeek]} ${clock(first.from)}–${clock(end)}`;
}
