import {
  attendanceFor,
  type EntryLike,
  matchShift,
  onBreak,
  workedMinutes,
} from './attendance.rules.js';

// All times are UTC here; the rules never look at wall-clock zones.
const at = (hhmm: string, day = '2026-10-01') => new Date(`${day}T${hhmm}:00Z`);
const shift = { startsAt: at('17:00'), endsAt: at('23:00'), breakMinutes: 30 };

function entry(inAt: string, outAt: string | null, breaks: [string, string | null][] = []): EntryLike {
  return {
    clockInAt: at(inAt),
    clockOutAt: outAt ? at(outAt) : null,
    breaks: breaks.map(([s, e]) => ({ startAt: at(s), endAt: e ? at(e) : null })),
  };
}

describe('workedMinutes', () => {
  it('subtracts breaks, counting open ones up to now', () => {
    expect(workedMinutes(entry('17:00', '23:00', [['20:00', '20:30']]), at('23:30'))).toBe(330);
    const running = entry('17:00', null, [['20:00', null]]);
    expect(workedMinutes(running, at('20:10'))).toBe(180);
    expect(onBreak(running)).toBe(true);
  });
});

describe('matchShift', () => {
  const lunch = { startsAt: at('11:00'), endsAt: at('15:00'), breakMinutes: 0 };
  it('matches a running shift or one starting within 30 minutes', () => {
    expect(matchShift([lunch, shift], at('16:35'))).toBe(shift);
    expect(matchShift([lunch, shift], at('12:00'))).toBe(lunch);
  });
  it('treats clock-ins too early or between shifts as unscheduled', () => {
    expect(matchShift([lunch, shift], at('16:00'))).toBeUndefined();
    expect(matchShift([lunch, shift], at('10:00'))).toBeUndefined();
  });
});

describe('attendanceFor', () => {
  it('reports upcoming, not-in and no-show shifts with no entries', () => {
    expect(attendanceFor(shift, [], at('16:00')).status).toBe('UPCOMING');
    expect(attendanceFor(shift, [], at('17:20')).status).toBe('NOT_IN');
    const noShow = attendanceFor(shift, [], at('23:30'));
    expect(noShow.status).toBe('NO_SHOW');
    expect(noShow.varianceMinutes).toBe(-330);
  });

  it('allows a 5-minute grace period before counting someone late', () => {
    expect(attendanceFor(shift, [entry('17:04', '23:00')], at('23:30')).lateMinutes).toBe(0);
    expect(attendanceFor(shift, [entry('17:18', '23:00')], at('23:30')).lateMinutes).toBe(18);
  });

  it('flags leaving early and computes variance against paid scheduled time', () => {
    const result = attendanceFor(shift, [entry('16:55', '22:00', [['19:30', '20:00']])], at('23:30'));
    expect(result).toMatchObject({
      status: 'COMPLETED',
      lateMinutes: 0,
      leftEarlyMinutes: 60,
      workedMinutes: 275,
      scheduledMinutes: 330,
      varianceMinutes: -55,
    });
  });

  it('distinguishes working from a forgotten clock-out', () => {
    expect(attendanceFor(shift, [entry('17:00', null)], at('22:00')).status).toBe('WORKING');
    expect(attendanceFor(shift, [entry('17:00', null)], at('23:30')).status).toBe('WORKING');
    expect(attendanceFor(shift, [entry('17:00', null)], at('00:30', '2026-10-02')).status).toBe(
      'MISSING_CLOCK_OUT',
    );
  });

  it('adds up split entries (clocked out and back in)', () => {
    const result = attendanceFor(
      shift,
      [entry('17:00', '19:00'), entry('19:30', '23:00')],
      at('23:30'),
    );
    expect(result.workedMinutes).toBe(330);
    expect(result.varianceMinutes).toBe(0);
  });
});
