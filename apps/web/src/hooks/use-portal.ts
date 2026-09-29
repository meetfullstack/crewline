"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Shift } from "@/lib/schedule";
import type { AvailabilityBlock, RequestStatus, TimeOffRequest, TimeOffType } from "@/lib/types";

export type MyShift = Shift & {
  position: { name: string; color: string };
  location: { name: string };
};

export type OpenShift = MyShift & { canClaim: boolean };

// ─── Shifts ────────────────────────────────────────────────────────────

export const useMyShifts = () =>
  useQuery({ queryKey: ["me", "shifts"], queryFn: () => api<MyShift[]>("/me/shifts") });

export const useMyOpenShifts = () =>
  useQuery({
    queryKey: ["me", "open-shifts"],
    queryFn: () => api<OpenShift[]>("/me/open-shifts"),
  });

export function useClaimShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<Shift>(`/me/open-shifts/${id}/claim`, { method: "POST" }),
    // Refresh either way: on a 409 someone else got it first.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}

// ─── Availability ──────────────────────────────────────────────────────

export const useMyAvailability = () =>
  useQuery({
    queryKey: ["me", "availability"],
    queryFn: () => api<AvailabilityBlock[]>("/me/availability"),
  });

export function useSaveMyAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blocks: AvailabilityBlock[]) =>
      api<AvailabilityBlock[]>("/me/availability", {
        method: "PUT",
        body: {
          blocks: blocks.map(({ dayOfWeek, startMinute, endMinute, kind }) => ({
            dayOfWeek,
            startMinute,
            endMinute,
            kind,
          })),
        },
      }),
    onSuccess: (saved) => queryClient.setQueryData(["me", "availability"], saved),
  });
}

// ─── Time off ──────────────────────────────────────────────────────────

export const useMyTimeOff = () =>
  useQuery({
    queryKey: ["me", "time-off"],
    queryFn: () => api<TimeOffRequest[]>("/me/time-off"),
  });

export function useRequestTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: TimeOffType;
      startDate: string;
      endDate: string;
      reason?: string;
    }) => api<TimeOffRequest>("/me/time-off", { method: "POST", body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "time-off"] }),
  });
}

export function useCancelTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/me/time-off/${id}`, { method: "DELETE" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["me", "time-off"] }),
  });
}

export const useTimeOffQueue = (status: RequestStatus | "ALL", enabled = true) =>
  useQuery({
    queryKey: ["time-off", status],
    queryFn: () => api<TimeOffRequest[]>(`/time-off?status=${status}`),
    enabled,
  });

export function useReviewTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      status: "APPROVED" | "DENIED";
      note?: string;
    }) => api<TimeOffRequest>(`/time-off/${id}`, { method: "PATCH", body: input }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
      // Approved time off shows up on the schedule grid.
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}
