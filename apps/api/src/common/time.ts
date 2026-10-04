import { TZDate } from '@date-fns/tz';
import { addDays, format, startOfWeek } from 'date-fns';

/**
 * Scheduling happens in a location's local time, but shifts are stored in UTC.
 * These helpers are the only place that conversion happens.
 */

/** A calendar day in `yyyy-MM-dd` form, interpreted in some location's zone. */
export type LocalDate = string;

/** UTC instant for `minutes` past local midnight on `date` in `timeZone`. */
export function zonedInstant(
  date: LocalDate,
  minutes: number,
  timeZone: string,
): Date {
  const [y, m, d] = date.split('-').map(Number);
  const local = new TZDate(
    y,
    m - 1,
    d,
    Math.floor(minutes / 60),
    minutes % 60,
    timeZone,
  );
  return new Date(local.getTime());
}

/** The local calendar day that `instant` falls on in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  return format(new TZDate(instant, timeZone), 'yyyy-MM-dd');
}

/** Local minutes past midnight for `instant` in `timeZone`. */
export function localMinutesOf(instant: Date, timeZone: string): number {
  const local = new TZDate(instant, timeZone);
  return local.getHours() * 60 + local.getMinutes();
}

/** First day of the scheduling week containing `instant`, in local time. */
export function weekStartOf(
  instant: Date,
  timeZone: string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
): LocalDate {
  const start = startOfWeek(new TZDate(instant, timeZone), { weekStartsOn });
  return format(start, 'yyyy-MM-dd');
}

/** `date` shifted by whole calendar days. */
export function addLocalDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  return format(addDays(new Date(y, m - 1, d), days), 'yyyy-MM-dd');
}

/** Weekday of a local calendar day (0 = Sunday … 6 = Saturday). */
export function dayOfWeekOf(date: LocalDate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** A `@db.Date` column value for a local calendar day. */
export function dateColumn(date: LocalDate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
