"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import type { DayLabor } from "@/hooks/use-dashboard";
import { formatMoney } from "@/lib/format";
import { formatDay } from "@/lib/schedule";

interface Point extends DayLabor {
  label: string;
  lastWeekCost: number;
  lastWeekHours: number;
}

/**
 * This week's labour cost per day. One series, so no legend: the card title
 * names it. Last week's same day rides in the tooltip and the table view.
 */
export function LaborChart({
  week,
  lastWeek,
  today,
}: {
  week: DayLabor[];
  lastWeek: DayLabor[];
  today: string;
}) {
  const data: Point[] = week.map((day, i) => ({
    ...day,
    label: formatDay(day.date).split(" ")[0],
    lastWeekCost: lastWeek[i]?.cost ?? 0,
    lastWeekHours: lastWeek[i]?.hours ?? 0,
  }));

  return (
    <figure className="grid gap-2">
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={({ x, y, payload, index }) => (
                <text
                  x={x}
                  y={Number(y) + 12}
                  textAnchor="middle"
                  fontSize={12}
                  fill={
                    data[index]?.date === today
                      ? "var(--foreground)"
                      : "var(--muted-foreground)"
                  }
                  fontWeight={data[index]?.date === today ? 600 : 400}
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis
              width={52}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => `$${v.toLocaleString("en-CA")}`}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={(props) => <LaborTooltip {...props} />}
            />
            <Bar
              dataKey="cost"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Same numbers for screen readers and anyone who prefers a table. */}
      <table className="sr-only">
        <caption>Scheduled labour cost by day, this week and last week</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">This week</th>
            <th scope="col">Last week</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatDay(d.date, "long")}</th>
              <td>
                {formatMoney(d.cost)} ({d.hours}h)
              </td>
              <td>
                {formatMoney(d.lastWeekCost)} ({d.lastWeekHours}h)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function LaborTooltip({
  active,
  payload,
}: Pick<TooltipContentProps<ValueType, NameType>, "active" | "payload">) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  const change = point.lastWeekCost
    ? ((point.cost - point.lastWeekCost) / point.lastWeekCost) * 100
    : null;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{formatDay(point.date, "long")}</p>
      <p className="flex items-center gap-1.5 text-foreground">
        <span aria-hidden className="size-2 rounded-sm bg-chart-1" />
        {formatMoney(point.cost)} · {point.hours}h
      </p>
      <p className="text-muted-foreground">
        Last week {formatMoney(point.lastWeekCost)}
        {change !== null && ` (${change >= 0 ? "+" : ""}${change.toFixed(0)}%)`}
      </p>
    </div>
  );
}
