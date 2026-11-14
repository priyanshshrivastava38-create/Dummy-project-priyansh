"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/utils";

const axisStyle = { fontSize: 11, fill: "#71717a" } as const;
const gridStroke = "#f1f1f4";

function moneyTick(value: number) {
  return formatMoney(value, "USD", { compact: true });
}

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid #e7e7ec",
  boxShadow: "0 8px 24px -12px rgba(24,24,27,0.25)",
  fontSize: 12,
  padding: "8px 10px",
} as const;

export function SpendTrendChart({
  data,
  currency = "USD",
}: {
  data: { month: string; spend: number; savings: number }[];
  currency?: string;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.24} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} dy={6} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={moneyTick} width={56} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              formatMoney(typeof value === "number" ? value : Number(value ?? 0), currency),
              name === "spend" ? "Awarded spend" : "Savings",
            ]}
          />
          <Area
            type="monotone"
            dataKey="spend"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#spendFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Area
            type="monotone"
            dataKey="savings"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#savingsFill)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
            animationDuration={1200}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DepartmentBarChart({
  data,
  currency = "USD",
}: {
  data: { name: string; spend: number; budget: number | null }[];
  currency?: string;
}) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} dy={6} interval={0} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={moneyTick} width={56} />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            contentStyle={tooltipStyle}
            formatter={(value, name) => [
              formatMoney(typeof value === "number" ? value : Number(value ?? 0), currency),
              name === "spend" ? "Awarded spend" : "Annual budget",
            ]}
          />
          <Bar dataKey="spend" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={34} animationDuration={800} />
          <Bar dataKey="budget" fill="#e4e4e7" radius={[4, 4, 0, 0]} maxBarSize={34} animationDuration={1000} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const vendorColors = ["#6366f1", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#a855f7"];

export function VendorSpendChart({ data, currency = "USD" }: { data: { name: string; spend: number }[]; currency?: string }) {
  const height = Math.max(220, data.length * 38 + 20);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
          <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={moneyTick} />
          <YAxis
            type="category"
            dataKey="name"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            width={110}
          />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            contentStyle={tooltipStyle}
            formatter={(value) => [
              formatMoney(typeof value === "number" ? value : Number(value ?? 0), currency),
              "Awarded spend",
            ]}
          />
          <Bar dataKey="spend" radius={[0, 4, 4, 0]} maxBarSize={22} animationDuration={800}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={vendorColors[index % vendorColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BottleneckChart({ data }: { data: { level: number; avgDays: number; count: number }[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
          <XAxis
            dataKey="level"
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            dy={6}
            tickFormatter={(level: number) => `Level ${level}`}
          />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit="d" width={36} />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.06)" }}
            contentStyle={tooltipStyle}
            formatter={(value) => [`${Number(value ?? 0)} days average`, "Decision time"]}
            labelFormatter={(level) => `Approval level ${String(level)}`}
          />
          <Bar dataKey="avgDays" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={56} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusDonut({ data }: { data: { name: string; value: number; color: string }[] }) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={92} />
          <Tooltip cursor={{ fill: "rgba(99,102,241,0.06)" }} contentStyle={tooltipStyle} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={800}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
