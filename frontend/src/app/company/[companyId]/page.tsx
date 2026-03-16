"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Line, LineChart, Tooltip } from "recharts";

import { ChartContainer } from "@/components/app/chart-container";

const trendData = [
  { year: "2020", profit: 120, assets: 400, cash: 150 },
  { year: "2021", profit: 180, assets: 500, cash: 200 },
  { year: "2022", profit: 150, assets: 550, cash: 180 },
  { year: "2023", profit: 250, assets: 700, cash: 300 },
  { year: "2024", profit: 320, assets: 850, cash: 420 },
];

export default function CompanyDashboardPage() {
  return (
    <div className="flex h-full w-full flex-col space-y-6">
      <div className="grid h-auto grid-cols-1 gap-6 xl:h-[460px] xl:grid-cols-2">
        <BentoCard title="Net Profit Trend (£m)">
          <ChartFrame>
            <ChartContainer height={220}>
              <LineChart data={trendData}>
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--cb-stroke-soft)", strokeWidth: 2 }} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="var(--astronaut-600)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--astronaut-600)", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ChartContainer>
          </ChartFrame>
        </BentoCard>

        <BentoCard title="Total Assets Growth (£m)">
          <ChartFrame>
            <ChartContainer height={220}>
              <LineChart data={trendData}>
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--cb-stroke-soft)", strokeWidth: 2 }} />
                <Line
                  type="monotone"
                  dataKey="assets"
                  stroke="var(--astronaut-700)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--astronaut-700)", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ChartContainer>
          </ChartFrame>
        </BentoCard>

        <BentoCard title="Cash Position (£m)">
          <ChartFrame>
            <ChartContainer height={220}>
              <LineChart data={trendData}>
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--cb-stroke-soft)", strokeWidth: 2 }} />
                <Line
                  type="monotone"
                  dataKey="cash"
                  stroke="var(--astronaut-400)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: "var(--astronaut-400)", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ChartContainer>
          </ChartFrame>
        </BentoCard>

        <BentoCard title="Platform Buyability Score" action={<ArrowUpRight className="h-4 w-4" />}>
          <div className="relative flex h-full w-full flex-col items-center justify-center">
            <div className="absolute h-40 w-40 rounded-full bg-gradient-to-tr from-[var(--astronaut-100)] to-transparent opacity-60 blur-2xl" />
            <span className="relative z-10 text-[80px] font-light leading-none tracking-tighter text-[var(--cb-text-strong)]">
              84
            </span>
            <span className="relative z-10 mt-3 flex items-center rounded-full bg-[var(--astronaut-100)] px-3 py-1 text-sm font-semibold text-[var(--astronaut-700)]">
              <ArrowUpRight weight="bold" className="mr-1" /> Prime Target Status
            </span>
          </div>
        </BentoCard>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-6 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Assets" value="£850.2m" trend="+21.4%" positive />
        <MetricCard label="Cash in Bank" value="£420.0m" trend="+40.0%" positive />
        <MetricCard label="Current Ratio" value="1.8x" trend="-0.1x" positive={false} />
        <MetricCard label="Debt to Equity" value="0.45" trend="Stable" neutral />
        <MetricCard label="PSC Stability" value="1,204" subtext="Days unch." neutral />
      </div>
    </div>
  );
}

function BentoCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="cb-card flex min-h-[220px] flex-col overflow-hidden rounded-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-[var(--cb-text-strong)]">{title}</h3>
        {action && <button className="text-[var(--cb-text-subtle)] transition-colors hover:text-[var(--cb-text-strong)]">{action}</button>}
      </div>
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return <div className="h-[220px] w-full min-w-0 xl:h-full">{children}</div>;
}

function MetricCard({
  label,
  value,
  trend,
  subtext,
  positive,
  neutral,
}: {
  label: string;
  value: string;
  trend?: string;
  subtext?: string;
  positive?: boolean;
  neutral?: boolean;
}) {
  const trendColor = neutral
    ? "text-[var(--cb-text-subtle)]"
    : positive
      ? "text-[var(--cb-success)]"
      : "text-[var(--cb-danger)]";
  const TrendIcon = neutral ? null : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="cb-card rounded-2xl p-5 transition-shadow hover:shadow-[0_10px_28px_rgba(20,35,60,0.08)]">
      <span className="text-xs font-medium text-[var(--cb-text-subtle)]">{label}</span>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{value}</span>
        {trend && (
          <span className={`flex items-center text-xs font-semibold ${trendColor}`}>
            {TrendIcon && <TrendIcon weight="bold" className="mr-0.5" />}
            {trend}
          </span>
        )}
        {subtext && <span className="text-xs font-medium text-[var(--cb-text-subtle)]">{subtext}</span>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-[var(--cb-text-strong)] px-3 py-2 text-xs text-white shadow-xl">
        <p className="mb-1 font-semibold text-white/70">{label}</p>
        <p className="text-lg font-bold">£{payload[0].value}m</p>
      </div>
    );
  }
  return null;
};
