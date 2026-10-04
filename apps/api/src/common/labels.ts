/** Human-readable shift labels for notifications: "Fri, Oct 2 · 4:30 PM". */
export function shiftLabel(shift: { date: string; startMinute: number } | null | undefined) {
  if (!shift) return 'a shift';
  const day = new Date(`${shift.date}T00:00:00Z`).toLocaleDateString('en-CA', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const h24 = Math.floor(shift.startMinute / 60) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const time = `${h12}:${String(shift.startMinute % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  return `${day} · ${time}`;
}

export function dateRangeLabel(startDate: string, endDate: string) {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString('en-CA', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
    });
  return startDate === endDate ? fmt(startDate) : `${fmt(startDate)} – ${fmt(endDate)}`;
}
