"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Analytics {
  location: { id: string; name: string };
  weekCount: number;
  currentWeek: string;
  weeklyBudget: number | null;
  weeks: {
    weekStart: string;
    scheduledHours: number;
    scheduledCost: number;
    workedHours: number;
    actualWages: number;
    shifts: number;
    late: number;
    noShows: number;
    inProgress: boolean;
  }[];
  totals: {
    scheduledHours: number;
    scheduledCost: number;
    workedHours: number;
    actualWages: number;
    averageWeeklyWages: number;
    weeksOverBudget: number;
    overtimeHours: number;
  };
  attendance: {
    shifts: number;
    late: number;
    lateRate: number;
    averageLateMinutes: number;
    noShows: number;
    noShowRate: number;
    leftEarly: number;
  };
  byPosition: { name: string; color: string; hours: number; cost: number }[];
  byWeekday: { dayOfWeek: number; averageCost: number; averageHours: number }[];
  team: {
    name: string;
    hours: number;
    avgWeeklyHours: number;
    overtimeHours: number;
    late: number;
    noShows: number;
  }[];
}

export const useAnalytics = (weeks: number) =>
  useQuery({
    queryKey: ["analytics", weeks],
    queryFn: () => api<Analytics>(`/analytics?weeks=${weeks}`),
    placeholderData: keepPreviousData,
  });
