const money = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
});

export const formatMoney = (dollars: number) => money.format(dollars);

/** 1020 → "5:00 PM", 1440 → "12:00 AM" (end of day). */
export function formatMinutes(minutes: number) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Date-only API values are midnight UTC; show them as the same calendar day. */
export function formatDateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** `yyyy-MM-dd` for a date input, from a date-only API value. */
export const toDateInput = (value: string | null | undefined) =>
  value ? value.slice(0, 10) : "";

export const fullName = (e: { firstName: string; lastName: string }) =>
  `${e.firstName} ${e.lastName}`;

export const initials = (e: { firstName: string; lastName: string }) =>
  `${e.firstName[0] ?? ""}${e.lastName[0] ?? ""}`.toUpperCase();

export const EMPLOYMENT_TYPE_LABEL = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CASUAL: "Casual",
} as const;

export const STATUS_LABEL = {
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  TERMINATED: "Terminated",
} as const;

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
