import type {
  AvailabilityKind,
  EmploymentStatus,
  Location,
  Position,
} from "./types";

/** `yyyy-MM-dd` calendar day in the location's time zone. */
export type LocalDate = string;

export interface Conflict {
  code: string;
  severity: "error" | "warning";
  message: string;
}

export interface Shift {
  id: string;
  scheduleId: string;
  locationId: string;
  positionId: string;
  employeeId: string | null;
  startsAt: string;
  endsAt: string;
  breakMinutes: number;
  notes: string | null;
  date: LocalDate;
  startMinute: number;
  /** May exceed 1440 for shifts that end after midnight. */
  endMinute: number;
  paidHours: number;
  cost: number;
  conflicts: Conflict[];
}

export interface WeekEmployee {
  id: string;
  firstName: string;
  lastName: string;
  status: EmploymentStatus;
  hourlyRate: number;
  maxWeeklyHours: number | null;
  positions: { id: string; isPrimary: boolean }[];
  availability: {
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    kind: AvailabilityKind;
  }[];
  timeOff: {
    id: string;
    type: string;
    status: "PENDING" | "APPROVED";
    startDate: LocalDate;
    endDate: LocalDate;
  }[];
}

export interface WeekSchedule {
  location: Pick<Location, "id" | "name" | "timezone" | "weekStartsOn">;
  weekStart: LocalDate;
  days: LocalDate[];
  schedule: {
    id: string;
    status: "DRAFT" | "PUBLISHED";
    publishedAt: string | null;
    hasUnpublishedChanges: boolean;
  } | null;
  positions: Pick<Position, "id" | "name" | "color">[];
  employees: WeekEmployee[];
  shifts: Shift[];
  summary: {
    totalHours: number;
    laborCost: number;
    openShifts: number;
    errors: number;
    warnings: number;
    byDay: { date: LocalDate; hours: number; cost: number }[];
  };
}

export interface ShiftInput {
  locationId: string;
  positionId: string;
  employeeId: string | null;
  date: LocalDate;
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
  notes: string | null;
}

// Local dates are handled as UTC midnights so the browser's own time zone
// never shifts a calendar day.
const toUtc = (date: LocalDate) => new Date(`${date}T00:00:00Z`);

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const dayOfWeek = (date: LocalDate) => toUtc(date).getUTCDay();

export function formatDay(date: LocalDate, style: "short" | "long" = "short") {
  return toUtc(date).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    weekday: style === "short" ? "short" : "long",
    month: style === "short" ? undefined : "long",
    day: "numeric",
  });
}

export function formatWeekRange(days: LocalDate[]) {
  const first = toUtc(days[0]);
  const last = toUtc(days[days.length - 1]);
  const month = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "UTC", month: "short" });
  const sameMonth = first.getUTCMonth() === last.getUTCMonth();
  return `${month(first)} ${first.getUTCDate()} – ${sameMonth ? "" : `${month(last)} `}${last.getUTCDate()}, ${last.getUTCFullYear()}`;
}

/** Compact clock for shift cards: 1020 → "5p", 1050 → "5:30p", 1500 → "1a". */
export function shortTime(minutes: number) {
  const m = minutes % 1440;
  const h24 = Math.floor(m / 60);
  const mins = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}${h24 < 12 ? "a" : "p"}`;
}

export const shiftRange = (s: Pick<Shift, "startMinute" | "endMinute">) =>
  `${shortTime(s.startMinute)} – ${shortTime(s.endMinute)}`;

/** Time off covering a given day, if any. Approved wins over pending. */
export function timeOffOn(employee: WeekEmployee, date: LocalDate) {
  const hits = employee.timeOff.filter(
    (t) => t.startDate <= date && t.endDate >= date,
  );
  return hits.find((t) => t.status === "APPROVED") ?? hits[0];
}

export function unavailableOn(employee: WeekEmployee, date: LocalDate) {
  const day = dayOfWeek(date);
  return employee.availability.filter(
    (a) => a.dayOfWeek === day && a.kind === "UNAVAILABLE",
  );
}

export const worstSeverity = (conflicts: Conflict[]) =>
  conflicts.some((c) => c.severity === "error")
    ? "error"
    : conflicts.length
      ? "warning"
      : null;

/** Droppable cell ids: `<employeeId | "open">|<date>`. */
export const OPEN_ROW = "open";
export const cellId = (employeeId: string | null, date: LocalDate) =>
  `${employeeId ?? OPEN_ROW}|${date}`;
export function parseCellId(id: string) {
  const [row, date] = id.split("|");
  return { employeeId: row === OPEN_ROW ? null : row, date };
}

/** Rules-engine messages name the employee; staff read them about themselves. */
export function asSecondPerson(message: string) {
  return message.replace(/^\S+ (isn't|is|has)\b/, (_, verb: string) =>
    verb === "is" ? "You're" : verb === "has" ? "You have" : "You aren't",
  );
}
