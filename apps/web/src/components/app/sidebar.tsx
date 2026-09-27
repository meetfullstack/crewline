"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/hooks/use-me";
import { navFor } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: me, isPending } = useMe();

  return (
    <div className="flex h-full flex-col gap-6 p-3">
      <Link
        href="/dashboard"
        className="px-2 pt-2"
        aria-label="Crewline dashboard"
        onClick={onNavigate}
      >
        <Logo />
      </Link>

      <div className="px-2">
        {isPending ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {me?.organization.name}
          </p>
        )}
      </div>

      <nav aria-label="Main" className="grid gap-0.5">
        {isPending
          ? Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="mx-2 my-1.5 h-5" />
            ))
          : navFor(me?.role).map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    active && "bg-sidebar-accent text-sidebar-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4",
                      active ? "text-brand" : "text-muted-foreground",
                    )}
                  />
                  {label}
                </Link>
              );
            })}
      </nav>
    </div>
  );
}
