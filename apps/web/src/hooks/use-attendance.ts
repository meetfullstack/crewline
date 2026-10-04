"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { LocalDate } from "@/lib/schedule";

export interface ClockState {
  now: string;
  entry: {
    id: string;
    clockInAt: string;
    onBreak: boolean;
    breakStartedAt: string | null;
    workedMinutes: number;
    breakMinutes: number;
    unscheduled: boolean;
  } | null;
  shift?: {
    id: string;
    startsAt: string;
    endsAt: string;
    date: LocalDate;
    startMinute: number;
    endMinute: number;
    position: { name: string; color: string };
    location: { name: string };
  } | null;
  clockInMatchesShift: boolean;
  lastWorkedMinutes?: number;
}

export type AttendanceStatus =
  | "UPCOMING"
  | "NOT_IN"
  | "WORKING"
  | "COMPLETED"
  | "MISSING_CLOCK_OUT"
  | "NO_SHOW";

export interface Attendance {
  status: AttendanceStatus;
  lateMinutes: number;
  leftEarlyMinutes: number;
  workedMinutes: number;
  scheduledMinutes: number;
  varianceMinutes: number;
}

export interface TimeEntry {
  id: string;
  shiftId: string | null;
  date: LocalDate;
  clockInAt: string;
  clockOutAt: string | null;
  clockInMinute: number;
  clockOutMinute: number | null;
  breakMinutes: number;
  workedMinutes: number;
  edited: { at: string; reason: string | null; by: string | null } | null;
}

export interface TimesheetRow {
  employee: { id: string; firstName: string; lastName: string };
  shifts: {
    id: string;
    date: LocalDate;
    startMinute: number;
    endMinute: number;
    position: { name: string; color: string };
    attendance: Attendance;
  }[];
  entries: TimeEntry[];
  totals: {
    scheduledHours: number;
    workedHours: number;
    varianceHours: number;
    wages: number;
    late: number;
    noShows: number;
    missingClockOuts: number;
    leftEarly: number;
    unscheduled: number;
  };
}

export interface Timesheet {
  location: { id: string; name: string; timezone: string };
  weekStart: LocalDate;
  days: LocalDate[];
  rows: TimesheetRow[];
  totals: {
    scheduledHours: number;
    workedHours: number;
    varianceHours: number;
    wages: number;
    late: number;
    noShows: number;
    missingClockOuts: number;
  };
}

// ─── Staff clock ───────────────────────────────────────────────────────

export const useClock = () =>
  useQuery({
    queryKey: ["me", "clock"],
    queryFn: () => api<ClockState>("/me/clock"),
    refetchInterval: 60_000,
  });

export function useClockAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: "in" | "out" | "break/start" | "break/end") =>
      api<ClockState>(`/me/clock/${action}`, { method: "POST" }),
    onSuccess: (state) => queryClient.setQueryData(["me", "clock"], state),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
  });
}

// ─── Manager timesheets ────────────────────────────────────────────────

export const useTimesheet = (locationId: string | undefined, weekStart?: LocalDate) =>
  useQuery({
    queryKey: ["timesheet", locationId, weekStart ?? "current"],
    queryFn: () =>
      api<Timesheet>(
        `/timesheets?locationId=${locationId}${weekStart ? `&weekStart=${weekStart}` : ""}`,
      ),
    enabled: Boolean(locationId),
    placeholderData: keepPreviousData,
  });

export interface EntryInput {
  date: LocalDate;
  clockInMinute: number;
  clockOutMinute: number;
  breakMinutes: number;
  reason: string;
}

function useEntryWrite<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export const useCreateEntry = () =>
  useEntryWrite((input: EntryInput & { employeeId: string; locationId: string }) =>
    api<TimeEntry>("/time-entries", { method: "POST", body: { ...input } }),
  );

export const useEditEntry = () =>
  useEntryWrite(({ id, ...input }: EntryInput & { id: string }) =>
    api<TimeEntry>(`/time-entries/${id}`, { method: "PATCH", body: { ...input } }),
  );
