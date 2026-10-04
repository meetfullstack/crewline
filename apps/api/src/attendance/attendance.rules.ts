/**
 * Attendance rules. Pure functions: given what was scheduled and what was
 * clocked, say how the shift actually went. Used by the staff clock, the
 * manager timesheet and the dashboard, so they always agree.
 */

/** Arriving within this many minutes of the start still counts as on time. */
export const LATE_GRACE_MINUTES = 5;
/** Leaving more than this many minutes before the end counts as early. */
export const EARLY_LEAVE_GRACE_MINUTES = 5;
/** Staff can clock in for a shift this long before it starts. */
export const EARLY_CLOCK_IN_MINUTES = 30;
/** An entry still open this long after its shift ended was probably forgotten. */
export const MISSING_CLOCK_OUT_AFTER_MINUTES = 60;

const MINUTE = 60_000;

export interface Interval {
  startAt: Date;
  endAt: Date | null;
}

export interface EntryLike {
  clockInAt: Date;
  clockOutAt: Date | null;
  breaks: Interval[];
}

export interface ShiftLike {
  startsAt: Date;
  endsAt: Date;
  breakMinutes: number;
}

export type AttendanceStatus =
  | 'UPCOMING' // not started yet, not clocked in
  | 'NOT_IN' // should have started, nobody clocked in yet
  | 'WORKING' // clocked in, shift still running
  | 'COMPLETED' // clocked in and out
  | 'MISSING_CLOCK_OUT' // still "clocked in" long after the shift ended
  | 'NO_SHOW'; // shift ended with no clock-in at all

export interface Attendance {
  status: AttendanceStatus;
  lateMinutes: number;
  leftEarlyMinutes: number;
  workedMinutes: number;
  scheduledMinutes: number;
  /** Worked minus scheduled paid minutes; positive means extra time. */
  varianceMinutes: number;
}

const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MINUTE;

/** Break time inside an entry; an open break counts up to `now`. */
export function breakMinutes(entry: EntryLike, now: Date) {
  return entry.breaks.reduce(
    (sum, b) => sum + Math.max(0, minutesBetween(b.startAt, b.endAt ?? now)),
    0,
  );
}

/** Paid time on the clock; an open entry counts up to `now`. */
export function workedMinutes(entry: EntryLike, now: Date) {
  const end = entry.clockOutAt ?? now;
  return Math.max(0, minutesBetween(entry.clockInAt, end) - breakMinutes(entry, now));
}

export const onBreak = (entry: EntryLike) =>
  entry.clockOutAt === null && entry.breaks.some((b) => b.endAt === null);

/**
 * Picks the shift a clock-in belongs to: one that is running, or starts
 * within the early clock-in window. The closest start wins.
 */
export function matchShift<T extends ShiftLike>(shifts: T[], clockIn: Date): T | undefined {
  return shifts
    .filter(
      (s) =>
        clockIn >= new Date(s.startsAt.getTime() - EARLY_CLOCK_IN_MINUTES * MINUTE) &&
        clockIn < s.endsAt,
    )
    .sort(
      (a, b) =>
        Math.abs(a.startsAt.getTime() - clockIn.getTime()) -
        Math.abs(b.startsAt.getTime() - clockIn.getTime()),
    )[0];
}

/** How a scheduled shift went, given its time entries (if any). */
export function attendanceFor(
  shift: ShiftLike,
  entries: EntryLike[],
  now: Date,
): Attendance {
  const scheduledMinutes =
    minutesBetween(shift.startsAt, shift.endsAt) - shift.breakMinutes;
  const worked = entries.reduce((sum, e) => sum + workedMinutes(e, now), 0);
  const base = {
    lateMinutes: 0,
    leftEarlyMinutes: 0,
    workedMinutes: Math.round(worked),
    scheduledMinutes: Math.round(scheduledMinutes),
    varianceMinutes: 0,
  };

  if (entries.length === 0) {
    const status: AttendanceStatus =
      now < shift.startsAt ? 'UPCOMING' : now < shift.endsAt ? 'NOT_IN' : 'NO_SHOW';
    return {
      ...base,
      status,
      varianceMinutes: status === 'NO_SHOW' ? -Math.round(scheduledMinutes) : 0,
    };
  }

  const first = entries.reduce((a, b) => (a.clockInAt <= b.clockInAt ? a : b));
  const lateBy = minutesBetween(shift.startsAt, first.clockInAt);
  const lateMinutes = lateBy > LATE_GRACE_MINUTES ? Math.round(lateBy) : 0;

  const open = entries.find((e) => e.clockOutAt === null);
  if (open) {
    const forgotten =
      minutesBetween(shift.endsAt, now) > MISSING_CLOCK_OUT_AFTER_MINUTES;
    return { ...base, lateMinutes, status: forgotten ? 'MISSING_CLOCK_OUT' : 'WORKING' };
  }

  const lastOut = entries.reduce((a, b) =>
    (a.clockOutAt as Date) >= (b.clockOutAt as Date) ? a : b,
  ).clockOutAt as Date;
  const earlyBy = minutesBetween(lastOut, shift.endsAt);
  return {
    ...base,
    status: 'COMPLETED',
    lateMinutes,
    leftEarlyMinutes: earlyBy > EARLY_LEAVE_GRACE_MINUTES ? Math.round(earlyBy) : 0,
    varianceMinutes: Math.round(worked - scheduledMinutes),
  };
}
