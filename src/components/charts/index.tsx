"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatIDR, formatIDRCompact } from "@/lib/currency";
import type { Slice } from "@/lib/stats";
import { cn } from "@/lib/utils";

/**
 * Charts. All of them read their chrome from the CSS theme variables, so the
 * same component is readable in light and dark mode (requirement 44).
 */

const AXIS = { stroke: "var(--muted-foreground)", fontSize: 11 } as const;

function TooltipCard({
  active,
  payload,
  label,
  total,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; payload?: { label?: string; count?: number; share?: number } }[];
  label?: string;
  total?: number;
}) {
  if (!active || !payload?.length) return null;
  const first = payload[0];
  const value = Number(first.value ?? 0);
  const name = first.payload?.label ?? first.name ?? "";

  return (
    <div className="bg-popover text-popover-foreground rounded-xl border border-border px-3 py-2 text-xs shadow-lg">
      {label && !first.payload?.label && <p className="mb-1 font-semibold">{label}</p>}
      {name && <p className="font-semibold">{name}</p>}
      <p className="text-primary mt-0.5 text-[13px] font-bold">{formatIDR(value)}</p>
      {typeof first.payload?.share === "number" && total ? (
        <p className="text-muted-foreground mt-0.5">
          {(first.payload.share * 100).toFixed(1)}% dari total
        </p>
      ) : null}
    </div>
  );
}

export function ChartFrame({
  title,
  description,
  action,
  height = 260,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  height?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ist-card p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
        </div>
        {action}
      </div>
      <div style={{ height }} className="w-full">
        {children}
      </div>
    </div>
  );
}

/** Shared legend row used under the donut charts. */
function SliceLegend({ data }: { data: Slice[] }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {data.map((slice) => (
        <li key={slice.key} className="flex items-center gap-2.5 text-[13px]">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: slice.color }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate font-medium">{slice.label}</span>
          <span className="text-muted-foreground shrink-0 tabular-nums">
            {slice.share > 0 ? `${Math.round(slice.share * 100)}%` : "—"}
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{formatIDR(slice.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export function DonutChart({
  data,
  total,
  height = 230,
}: {
  data: Slice[];
  total: number;
  height?: number;
}) {
  return (
    <div>
      <div style={{ height }} className="relative w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="label"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<TooltipCard total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-muted-foreground text-[11px] font-medium">Total</p>
          <p className="text-[15px] font-bold tracking-tight">{formatIDR(total)}</p>
        </div>
      </div>
      <SliceLegend data={data} />
    </div>
  );
}

export function MemberBarChart({ data, height = 260 }: { data: Slice[]; height?: number }) {
  // Long member names would crush the axis, so the chart is vertical when few.
  const chartData = data.slice(0, 10).map((slice) => ({
    label: slice.label.length > 12 ? `${slice.label.slice(0, 11)}…` : slice.label,
    fullLabel: slice.label,
    amount: slice.amount,
    share: slice.share,
    count: slice.count,
    color: slice.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={{ ...AXIS, fontSize: 10 }}
          height={38}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={54}
          tick={{ ...AXIS, fontSize: 10 }}
          tickFormatter={(value: number) => formatIDRCompact(value)}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          content={<TooltipCard />}
        />
        <Bar dataKey="amount" radius={[8, 8, 4, 4]} maxBarSize={46}>
          {chartData.map((entry) => (
            <Cell key={entry.label} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpendingLineChart({
  data,
  height = 260,
}: {
  data: { label: string; amount: number; date?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} minTickGap={16} height={32} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={54}
          tick={{ ...AXIS, fontSize: 10 }}
          tickFormatter={(value: number) => formatIDRCompact(value)}
        />
        <Tooltip content={<TooltipCard />} />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="var(--primary)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
