"use client";

import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { api } from "@/lib/api";

/** Which cached data each server event makes stale. */
const STALE: Record<string, QueryKey[]> = {
  "schedule.changed": [["schedule"], ["me", "shifts"], ["me", "open-shifts"], ["me", "clock"], ["dashboard"], ["timesheet"]],
  "attendance.changed": [["timesheet"], ["dashboard"]],
  "timeoff.changed": [["time-off"], ["me", "time-off"], ["dashboard"]],
  "swaps.changed": [["swaps"], ["me", "swaps"], ["dashboard"]],
};

interface NotificationEvent {
  title: string;
  body?: string;
  href?: string;
}

/**
 * Keeps every open screen current. The socket only says *what* changed;
 * data is refetched through the normal API, so nothing sensitive rides on it.
 */
export function RealtimeProvider() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const router = useRouter();
  const userId = me?.id;

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!userId || !url) return;

    const socket = io(url, {
      transports: ["websocket"],
      // A fresh short-lived token on every (re)connect.
      auth: (cb) => {
        api<{ token: string }>("/auth/socket-token")
          .then(({ token }) => cb({ token }))
          .catch(() => cb({}));
      },
    });

    for (const [event, keys] of Object.entries(STALE)) {
      socket.on(event, () => {
        for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
      });
    }
    socket.on("notification", (n: NotificationEvent) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast(n.title, {
        description: n.body,
        action: n.href ? { label: "View", onClick: () => router.push(n.href!) } : undefined,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, queryClient, router]);

  return null;
}
