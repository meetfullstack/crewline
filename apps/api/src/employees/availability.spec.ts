import { availabilityProblem } from './availability.js';

describe('availabilityProblem', () => {
  it('accepts separate blocks on the same day and blocks on other days', () => {
    expect(
      availabilityProblem([
        { dayOfWeek: 1, startMinute: 0, endMinute: 600 },
        { dayOfWeek: 1, startMinute: 600, endMinute: 900 },
        { dayOfWeek: 2, startMinute: 0, endMinute: 1440 },
      ]),
    ).toBeNull();
  });

  it('rejects zero-length or inverted blocks', () => {
    expect(
      availabilityProblem([{ dayOfWeek: 3, startMinute: 900, endMinute: 900 }]),
    ).toBe('Wed: end time must be after start time');
  });

  it('rejects overlaps within a day regardless of input order', () => {
    expect(
      availabilityProblem([
        { dayOfWeek: 5, startMinute: 1020, endMinute: 1320 },
        { dayOfWeek: 5, startMinute: 600, endMinute: 1080 },
      ]),
    ).toBe('Fri: time ranges overlap');
  });
});
