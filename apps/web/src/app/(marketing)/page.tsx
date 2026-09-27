import {
  ArrowRight,
  CalendarRange,
  ChartColumn,
  Clock,
  Repeat,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: CalendarRange,
    title: "Drag-and-drop schedule builder",
    body: "Build the week on one screen. Drop people onto shifts, copy last week, and publish when it's right.",
  },
  {
    icon: ShieldCheck,
    title: "Conflicts caught before they happen",
    body: "Double-bookings, approved time off, availability and max-hours limits are checked as you schedule.",
  },
  {
    icon: ChartColumn,
    title: "Labour cost you can see",
    body: "Scheduled hours and wages add up live, per day and per position, so the week stays on budget.",
  },
  {
    icon: Smartphone,
    title: "A portal your crew will use",
    body: "Staff see their shifts, set availability, request time off and pick up open shifts from their phone.",
  },
  {
    icon: Repeat,
    title: "Swaps and open shifts",
    body: "Post an open shift and let qualified staff claim it. Managers approve with one tap.",
  },
  {
    icon: Clock,
    title: "Time & attendance",
    body: "Clock in and out, track breaks, and flag lates and overtime before payroll does.",
  },
];

// Static preview of the schedule grid for the hero.
const PREVIEW = [
  { name: "Maya R.", role: "Server", shifts: [[0, "11–5"], [2, "11–5"], [4, "4–11"], [5, "4–11"]] },
  { name: "Jonah K.", role: "Line cook", shifts: [[0, "2–10"], [1, "2–10"], [3, "2–10"], [5, "10–6"]] },
  { name: "Ana P.", role: "Bartender", shifts: [[1, "5–1"], [3, "5–1"], [4, "5–1"], [5, "5–1"]] },
  { name: "Leo T.", role: "Host", shifts: [[2, "5–10"], [4, "5–10"], [6, "10–4"]] },
] as const;

const ROLE_COLOR: Record<string, string> = {
  Server: "bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/30",
  "Line cook": "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30",
  Bartender: "bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-violet-500/30",
  Host: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" aria-label="Crewline home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:pt-24">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-brand-soft px-3 py-1 text-xs font-medium text-foreground/80">
            <span className="size-1.5 rounded-full bg-brand" />
            Built for restaurants, bars and cafés
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            The schedule is done before service starts.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted-foreground">
            Crewline brings scheduling, staff availability, time off and labour
            costs into one calm workspace, so managers spend less time on
            spreadsheets and more time on the floor.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" className="h-11 px-5 text-base" asChild>
              <Link href="/register">
                Start scheduling free <ArrowRight />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5 text-base"
              asChild
            >
              <Link href="/login">Sign in to your team</Link>
            </Button>
          </div>
        </section>

        <section
          aria-label="Schedule preview"
          className="mx-auto max-w-5xl px-4 pb-20"
        >
          <div className="overflow-x-auto rounded-2xl border bg-card shadow-xl shadow-foreground/5">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[150px_repeat(7,1fr)] border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                <div className="px-4 py-2.5">Team</div>
                {DAYS.map((day) => (
                  <div key={day} className="border-l px-2 py-2.5 text-center">
                    {day}
                  </div>
                ))}
              </div>
              {PREVIEW.map((row) => (
                <div
                  key={row.name}
                  className="grid grid-cols-[150px_repeat(7,1fr)] border-b last:border-b-0"
                >
                  <div className="px-4 py-3">
                    <div className="text-sm font-medium">{row.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.role}
                    </div>
                  </div>
                  {DAYS.map((_, day) => {
                    const shift = row.shifts.find(([d]) => d === day);
                    return (
                      <div key={day} className="border-l p-1.5">
                        {shift && (
                          <div
                            className={`rounded-md px-2 py-1.5 text-xs font-medium ring-1 ring-inset ${ROLE_COLOR[row.role]}`}
                          >
                            {shift[1]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight">
              Everything the back office needs, nothing it doesn&apos;t.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-xl border bg-card p-5">
                  <div className="mb-4 grid size-9 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <Logo className="text-sm" />
          <p>A portfolio project by Meet Upadhyay.</p>
        </div>
      </footer>
    </div>
  );
}
