"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  AvailabilityBlock,
  Certification,
  EmployeeDetail,
  EmployeeInput,
  EmployeeSummary,
  EmploymentStatus,
  Location,
  Position,
} from "@/lib/types";

export interface EmployeeFilters {
  q?: string;
  status?: EmploymentStatus | "ALL";
  positionId?: string;
}

const keys = {
  all: ["employees"] as const,
  list: (filters: EmployeeFilters) => ["employees", "list", filters] as const,
  detail: (id: string) => ["employees", "detail", id] as const,
};

export function useEmployees(filters: EmployeeFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => api<EmployeeSummary[]>(`/employees?${params}`),
    // Keep the table on screen while a new search loads.
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => api<EmployeeDetail>(`/employees/${id}`),
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    queryFn: () => api<Position[]>("/positions"),
    staleTime: 5 * 60_000,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: () => api<Location[]>("/locations"),
    staleTime: 5 * 60_000,
  });
}

/** Writes return the fresh employee; seed the detail cache and refresh lists. */
function useEmployeeWrite<TArgs>(
  fn: (args: TArgs) => Promise<EmployeeDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (employee) => {
      queryClient.setQueryData(keys.detail(employee.id), employee);
      queryClient.invalidateQueries({ queryKey: ["employees", "list"] });
    },
  });
}

export const useCreateEmployee = () =>
  useEmployeeWrite((input: EmployeeInput) =>
    api<EmployeeDetail>("/employees", { method: "POST", body: { ...input } }),
  );

export const useUpdateEmployee = (id: string) =>
  useEmployeeWrite((input: Partial<EmployeeInput>) =>
    api<EmployeeDetail>(`/employees/${id}`, {
      method: "PATCH",
      body: { ...input },
    }),
  );

export const useReplaceAvailability = (id: string) =>
  useEmployeeWrite((blocks: AvailabilityBlock[]) =>
    api<EmployeeDetail>(`/employees/${id}/availability`, {
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
  );

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export function useCertificationMutations(employeeId: string) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: keys.all });

  return {
    add: useMutation({
      mutationFn: (input: Omit<Certification, "id">) =>
        api<Certification>(`/employees/${employeeId}/certifications`, {
          method: "POST",
          body: {
            name: input.name,
            issuedAt: input.issuedAt || undefined,
            expiresAt: input.expiresAt || undefined,
          },
        }),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (certificationId: string) =>
        api(`/employees/${employeeId}/certifications/${certificationId}`, {
          method: "DELETE",
        }),
      onSuccess: refresh,
    }),
  };
}
