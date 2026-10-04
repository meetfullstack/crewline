"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Conflict, LocalDate } from "@/lib/schedule";

export interface DayLabor {
  date: LocalDate;
  hours: number;
  cost: number;
}

export interface WeekStatus {
  weekStart: LocalDate;
  status: "DRAFT" | "PUBLISHED" | null;
  hasUnpublishedChanges: boolean;
  shifts: number;
  hours: number;
  cost: number;
  openShifts: number;
  errors: number;
  warnings: number;
}

export interface Dashboard {
  location: { id: string; name: string; timezone: string };
  date: LocalDate;
  generatedAt: string;
  staffing: {
    shifts: {
      id: string;
      startMinute: number;
      endMinute: number;
      paidHours: number;
      cost: number;
      state: "upcoming" | "on" | "done";
      position: { id: string; name: string; color: string } | null;
      employee: { id: string; firstName: string; lastName: string } | null;
      conflicts: Conflict[];
      attendance: {
        status: "UPCOMING" | "NOT_IN" | "WORKING" | "COMPLETED" | "MISSING_CLOCK_OUT" | "NO_SHOW";
        lateMinutes: number;
      } | null;
    }[];
    scheduled: number;
    onNow: number;
    notIn: number;
    late: number;
    open: number;
    hours: number;
    cost: number;
  };
  labor: {
    weeklyBudget: number | null;
    week: { weekStart: LocalDate; hours: number; cost: number; byDay: DayLabor[] };
    lastWeek: { hours: number; cost: number; byDay: DayLabor[] };
  };
  weeks: WeekStatus[];
  openShiftsNext7Days: number;
  pendingTimeOff: {
    count: number;
    next: {
      id: string;
      startDate: string;
      endDate: string;
      type: string;
      employee: { firstName: string; lastName: string };
    }[];
  };
  swapsAwaitingApproval: number;
  certifications: {
    id: string;
    name: string;
    expiresAt: string;
    expired: boolean;
    employee: { id: string; firstName: string; lastName: string };
  }[];
}

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
    // Keep "who's on now" reasonably fresh while the page is open.
    refetchInterval: 5 * 60_000,
  });
