import { cn } from "cn";

/** Crewline mark: three staggered shift bars on an ember tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <rect x="7" y="8.5" width="13" height="3.5" rx="1.75" fill="white" />
      <rect
        x="11"
        y="14.25"
        width="14"
        height="3.5"
        rx="1.75"
        fill="white"
        opacity="0.9"
      />
      <rect
        x="7"
        y="20"
        width="9"
        height="3.5"
        rx="1.75"
        fill="white"
        opacity="0.75"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[1.05rem] font-semibold tracking-tight",
        className,
      )}
    >
      <LogoMark />
      Crewline
    </span>
  );
}
