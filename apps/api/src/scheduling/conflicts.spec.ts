import { zonedInstant } from '../common/time.js';
import {
  type ConflictCode,
  type EmployeeContext,
  findConflicts,
  localSegments,
  paidHours,
  type ShiftLike,
} from './conflicts.js';

const TZ = 'America/Toronto';
const WEEK = '2026-09-28'; // a Monday
const SERVER = 'pos-server';
const BAR = 'pos-bar';

/** Shift on a local date from `from` to `to` hours; `to` > 24 runs overnight. */
function shift(date: string, from: number, to: number, extra: Partial<ShiftLike> = {}): ShiftLike {
  const startsAt = zonedInstant(date, from * 60, TZ);
  return {
    employeeId: 'e1',
    positionId: SERVER,
    startsAt,
    endsAt: new Date(startsAt.getTime() + (to - from) * 3_600_000),
    breakMinutes: 0,
    ...extra,
  };
}

function employee(overrides: Partial<EmployeeContext> = {}): EmployeeContext {
  return {
    id: 'e1',
    firstName: 'Maya',
    status: 'ACTIVE',
    positionIds: [SERVER],
    maxWeeklyHours: null,
    availability: [],
    timeOff: [],
    ...overrides,
  };
}

const codes = (
  target: ShiftLike,
  emp = employee(),
  otherShifts: ShiftLike[] = [],
): ConflictCode[] =>
  findConflicts(target, { employee: emp, otherShifts, timeZone: TZ, weekStart: WEEK }).map(
    (c) => c.code,
  );

describe('findConflicts', () => {
  it('returns nothing for a clean shift or an open shift', () => {
    expect(codes(shift(WEEK, 16, 22))).toEqual([]);
    expect(codes(shift(WEEK, 16, 22, { employeeId: null }), employee({ status: 'TERMINATED' }))).toEqual([]);
  });

  it('flags double-booking but not back-to-back shifts', () => {
    const lunch = shift(WEEK, 11, 16, { id: 's1' });
    expect(codes(shift(WEEK, 15, 22), employee(), [lunch])).toContain('OVERLAP');
    expect(codes(shift(WEEK, 16, 22), employee(), [lunch])).not.toContain('OVERLAP');
  });

  it('does not conflict with its own saved copy while editing', () => {
    const saved = shift(WEEK, 16, 22, { id: 's1' });
    expect(codes({ ...saved, endsAt: shift(WEEK, 16, 23).endsAt }, employee(), [saved])).toEqual([]);
  });

  it('flags a "clopen" with less than 8 hours of rest', () => {
    const close = shift(WEEK, 17, 25, { id: 's1' }); // until 1am Tuesday
    expect(codes(shift('2026-09-29', 7, 12), employee(), [close])).toEqual(['SHORT_REST']);
    expect(codes(shift('2026-09-29', 10, 15), employee(), [close])).toEqual([]);
  });

  it('allows same-day split shifts with a short gap', () => {
    const lunch = shift(WEEK, 11, 15, { id: 's1' });
    expect(codes(shift(WEEK, 17, 22), employee(), [lunch])).toEqual([]);
  });

  it('treats approved time off as an error and pending as a warning', () => {
    const vacation = { startDate: '2026-09-30', endDate: '2026-10-02', status: 'APPROVED' as const };
    const pending = { ...vacation, status: 'PENDING' as const };
    const denied = { ...vacation, status: 'DENIED' as const };

    const wed = shift('2026-09-30', 16, 22);
    expect(findConflicts(wed, { employee: employee({ timeOff: [vacation] }), otherShifts: [], timeZone: TZ, weekStart: WEEK })[0]).toMatchObject({ code: 'TIME_OFF', severity: 'error' });
    expect(codes(wed, employee({ timeOff: [pending] }))).toEqual(['TIME_OFF_PENDING']);
    expect(codes(wed, employee({ timeOff: [denied] }))).toEqual([]);
    // An overnight shift from Tuesday runs into the first day off.
    expect(codes(shift('2026-09-29', 20, 26), employee({ timeOff: [vacation] }))).toEqual(['TIME_OFF']);
  });

  it('checks availability on every local day an overnight shift touches', () => {
    // Unavailable Tuesday mornings (Tue = 2).
    const emp = employee({
      availability: [{ dayOfWeek: 2, startMinute: 0, endMinute: 9 * 60, kind: 'UNAVAILABLE' }],
    });
    expect(codes(shift(WEEK, 18, 23), emp)).toEqual([]);
    expect(codes(shift(WEEK, 18, 26), emp)).toEqual(['UNAVAILABLE']);
    // Preferred blocks never produce warnings.
    expect(codes(shift(WEEK, 18, 23), employee({ availability: [{ dayOfWeek: 1, startMinute: 0, endMinute: 1440, kind: 'PREFERRED' }] }))).toEqual([]);
  });

  it('warns past max weekly hours and past the overtime threshold', () => {
    const weekdays = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
    const week = weekdays.map((date, i) => shift(date, 9, 18, { id: `s${i}` })); // 5 × 9h = 45h
    const saturday = shift('2026-10-03', 10, 14);
    const result = codes(saturday, employee({ maxWeeklyHours: 40 }), week);
    expect(result).toEqual(expect.arrayContaining(['MAX_HOURS', 'OVERTIME']));

    // Only the shift that crosses the line is flagged, not the ones before it.
    expect(codes({ ...week[0] }, employee({ maxWeeklyHours: 40 }), [...week.slice(1), saturday])).toEqual([]);

    // Shifts outside the scheduling week don't count toward it.
    const lastWeek = shift('2026-09-27', 9, 18, { id: 'prev' });
    expect(codes(shift(WEEK, 9, 13), employee({ maxWeeklyHours: 5 }), [lastWeek])).toEqual([]);
  });

  it('flags positions the employee is not trained for, and inactive staff', () => {
    expect(codes(shift(WEEK, 17, 23, { positionId: BAR }))).toEqual(['NOT_QUALIFIED']);
    expect(codes(shift(WEEK, 17, 23), employee({ status: 'ON_LEAVE' }))).toEqual(['INACTIVE']);
  });
});

describe('paidHours', () => {
  it('subtracts unpaid breaks', () => {
    expect(paidHours(shift(WEEK, 16, 23, { breakMinutes: 30 }))).toBe(6.5);
  });
});

describe('localSegments', () => {
  it('splits an overnight shift at local midnight', () => {
    expect(localSegments(shift(WEEK, 20, 26), TZ)).toEqual([
      { date: '2026-09-28', dayOfWeek: 1, from: 1200, to: 1440 },
      { date: '2026-09-29', dayOfWeek: 2, from: 0, to: 120 },
    ]);
  });
});
