"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Location, Organization, Position } from "@/lib/types";

export const useOrganization = () =>
  useQuery({
    queryKey: ["organization"],
    queryFn: () => api<Organization>("/organization"),
  });

export function useRenameOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<Organization>("/organization", { method: "PATCH", body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      // The sidebar shows the business name via /auth/me.
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export type LocationInput = Partial<
  Pick<Location, "name" | "address" | "timezone" | "weekStartsOn" | "weeklyLaborBudget">
>;

function useLocationWrite<T>(fn: (input: T) => Promise<Location>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export const useCreateLocation = () =>
  useLocationWrite((input: LocationInput & { name: string }) =>
    api<Location>("/locations", { method: "POST", body: input }),
  );

export const useUpdateLocation = () =>
  useLocationWrite(({ id, ...input }: LocationInput & { id: string }) =>
    api<Location>(`/locations/${id}`, { method: "PATCH", body: input }),
  );

function usePositionWrite<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
}

export const useCreatePosition = () =>
  usePositionWrite((input: { name: string; color: string }) =>
    api<Position>("/positions", { method: "POST", body: input }),
  );

export const useUpdatePosition = () =>
  usePositionWrite(({ id, ...input }: { id: string; name?: string; color?: string }) =>
    api<Position>(`/positions/${id}`, { method: "PATCH", body: input }),
  );

export const useDeletePosition = () =>
  usePositionWrite((id: string) => api(`/positions/${id}`, { method: "DELETE" }));
