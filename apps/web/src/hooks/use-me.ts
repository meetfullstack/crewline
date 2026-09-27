"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";

export const meQueryKey = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: () => api<Me>("/auth/me"),
    staleTime: 5 * 60_000,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST", noRefresh: true }),
    onSettled: () => {
      queryClient.clear();
      router.replace("/login");
      router.refresh();
    },
  });
}
