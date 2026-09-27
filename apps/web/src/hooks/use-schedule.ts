"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  Conflict,
  LocalDate,
  Shift,
  ShiftInput,
  WeekSchedule,
} from "@/lib/schedule";

const weekKey = (locationId?: string, weekStart?: string) =>
  ["schedule", "week", locationId, weekStart ?? "current"] as const;

export function useWeek(locationId: string | undefined, weekStart?: LocalDate) {
  const params = new URLSearchParams();
  if (locationId) params.set("locationId", locationId);
  if (weekStart) params.set("weekStart", weekStart);
  return useQuery({
    queryKey: weekKey(locationId, weekStart),
    queryFn: () => api<WeekSchedule>(`/schedules/week?${params}`),
    enabled: Boolean(locationId),
    placeholderData: keepPreviousData,
  });
}

/** Every schedule write refreshes all loaded weeks (hours roll across weeks). */
function useScheduleMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["schedule", "week"] }),
  });
}

export const useCreateShift = () =>
  useScheduleMutation((input: ShiftInput) =>
    api<Shift>("/shifts", { method: "POST", body: { ...input } }),
  );

export const useUpdateShift = () =>
  useScheduleMutation(({ id, ...input }: Partial<ShiftInput> & { id: string }) =>
    api<Shift>(`/shifts/${id}`, { method: "PATCH", body: { ...input } }),
  );

export const useDeleteShift = () =>
  useScheduleMutation((id: string) =>
    api(`/shifts/${id}`, { method: "DELETE" }),
  );

export const useCopyWeek = () =>
  useScheduleMutation(
    (input: {
      locationId: string;
      fromWeekStart: LocalDate;
      toWeekStart: LocalDate;
      mode: "replace" | "append";
    }) =>
      api<{ copied: number; reassignedToOpen: number }>("/schedules/copy", {
        method: "POST",
        body: input,
      }),
  );

export const usePublishWeek = () =>
  useScheduleMutation((input: { locationId: string; weekStart: LocalDate }) =>
    api<{ publishedAt: string; shifts: number }>("/schedules/publish", {
      method: "POST",
      body: input,
    }),
  );

/**
 * Moves a shift to another person/day. The grid updates instantly and rolls
 * back if the API rejects the change.
 */
export function useMoveShift(key: { locationId?: string; weekStart?: string }) {
  const queryClient = useQueryClient();
  const queryKey = weekKey(key.locationId, key.weekStart);

  return useMutation({
    mutationFn: ({
      id,
      employeeId,
      date,
    }: {
      id: string;
      employeeId: string | null;
      date: LocalDate;
    }) =>
      api<Shift>(`/shifts/${id}`, {
        method: "PATCH",
        body: { employeeId, date },
      }),
    onMutate: async (move) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WeekSchedule>(queryKey);
      if (previous) {
        queryClient.setQueryData<WeekSchedule>(queryKey, {
          ...previous,
          shifts: previous.shifts.map((s) =>
            s.id === move.id
              ? { ...s, employeeId: move.employeeId, date: move.date }
              : s,
          ),
        });
      }
      return { previous };
    },
    onError: (_error, _move, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["schedule", "week"] }),
  });
}

export function checkShift(input: ShiftInput & { shiftId?: string }) {
  return api<Conflict[]>("/shifts/check", {
    method: "POST",
    body: { ...input },
  });
}
