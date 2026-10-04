"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "cn";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";

interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

function timeAgo(iso: string, now: number) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<{ items: NotificationItem[]; unread: number }>("/notifications"),
  });
  const readAll = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const unread = data?.unread ?? 0;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setNow(Date.now());
        // Opening the list marks everything as seen.
        if (!next && unread) readAll.mutate();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4 font-semibold text-brand-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="text-sm font-medium">Notifications</p>
          {unread > 0 && <span className="text-xs text-muted-foreground">{unread} new</span>}
        </div>
        {data?.items.length ? (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {data.items.map((n) => {
              const body = (
                <>
                  <span className="flex items-start gap-2">
                    {!n.readAt && <span aria-label="Unread" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />}
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{n.title}</span>
                      {n.body && <span className="block text-xs text-muted-foreground">{n.body}</span>}
                      <span className="block text-[11px] text-muted-foreground">{timeAgo(n.createdAt, now)}</span>
                    </span>
                  </span>
                </>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className={cn("block px-4 py-2.5 hover:bg-muted/50", n.readAt && "opacity-70")}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={cn("px-4 py-2.5", n.readAt && "opacity-70")}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
