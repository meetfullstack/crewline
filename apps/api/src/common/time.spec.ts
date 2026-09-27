import {
  addLocalDays,
  localDateOf,
  localMinutesOf,
  weekStartOf,
  zonedInstant,
} from './time.js';

const TORONTO = 'America/Toronto';

describe('time helpers', () => {
  it('converts local wall-clock time to UTC', () => {
    // Toronto is UTC-4 in September (EDT).
    expect(zonedInstant('2026-09-28', 17 * 60, TORONTO).toISOString()).toBe(
      '2026-09-28T21:00:00.000Z',
    );
    // ...and UTC-5 in January (EST).
    expect(zonedInstant('2026-01-12', 9 * 60 + 30, TORONTO).toISOString()).toBe(
      '2026-01-12T14:30:00.000Z',
    );
  });

  it('round-trips an instant back to local date and minutes', () => {
    const lateClose = zonedInstant('2026-09-28', 23 * 60 + 45, TORONTO);
    expect(localDateOf(lateClose, TORONTO)).toBe('2026-09-28');
    expect(localMinutesOf(lateClose, TORONTO)).toBe(23 * 60 + 45);
  });

  it('finds the local week start, not the UTC one', () => {
    // Sunday 9pm in Toronto is already Monday in UTC.
    const sundayNight = zonedInstant('2026-09-27', 21 * 60, TORONTO);
    expect(weekStartOf(sundayNight, TORONTO, 1)).toBe('2026-09-21');
    expect(weekStartOf(sundayNight, TORONTO, 0)).toBe('2026-09-27');
  });

  it('adds calendar days across month boundaries', () => {
    expect(addLocalDays('2026-09-28', 6)).toBe('2026-10-04');
  });
});
