"use client";

import React from "react";
import { ArrowUpRight, Swap } from "@phosphor-icons/react/dist/ssr";
import { Line, LineChart, Tooltip } from "recharts";

import { ChartContainer } from "@/components/app/chart-container";

const comparisonData = [
  { year: "2020", starlingProfit: 120, monzoProfit: 75, starlingAssets: 400, monzoAssets: 250 },
  { year: "2021", starlingProfit: 180, monzoProfit: 110, starlingAssets: 500, monzoAssets: 310 },
  { year: "2022", starlingProfit: 150, monzoProfit: 95, starlingAssets: 550, monzoAssets: 380 },
  { year: "2023", starlingProfit: 250, monzoProfit: 145, starlingAssets: 700, monzoAssets: 470 },
  { year: "2024", starlingProfit: 320, monzoProfit: 190, starlingAssets: 850, monzoAssets: 560 },
];

export default function ComparePage() {
  return (
    <div className="flex h-full w-full flex-col space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CompanySummaryCard
          name="Starling Bank Limited"
          companyNumber="09092149"
          tone="blue"
          metrics={[
            ["Assets", "£850.2m"],
            ["Cash", "£420.0m"],
            ["Buyability", "84"],
            ["Current ratio", "1.8x"],
          ]}
        />
        <CompanySummaryCard
          name="Monzo Bank Ltd"
          companyNumber="09446231"
          tone="slate"
          metrics={[
            ["Assets", "£560.0m"],
            ["Cash", "£250.0m"],
            ["Buyability", "72"],
            ["Current ratio", "1.5x"],
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <CompareChartCard title="Net Profit Trend (£m)">
          <ChartFrame>
            <ChartContainer height={240}>
              <LineChart data={comparisonData}>
                <Tooltip content={<CompareTooltip prefix="£" suffix="m" />} cursor={{ stroke: "var(--cb-stroke-soft)", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="starlingProfit" stroke="var(--astronaut-600)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="monzoProfit" stroke="var(--cb-text-subtle)" strokeWidth={2.5} dot={false} strokeDasharray="6 6" />
              </LineChart>
            </ChartContainer>
          </ChartFrame>
        </CompareChartCard>

        <CompareChartCard title="Assets Trend (£m)">
          <ChartFrame>
            <ChartContainer height={240}>
              <LineChart data={comparisonData}>
                <Tooltip content={<CompareTooltip prefix="£" suffix="m" />} cursor={{ stroke: "var(--cb-stroke-soft)", strokeWidth: 2 }} />
                <Line type="monotone" dataKey="starlingAssets" stroke="var(--astronaut-700)" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="monzoAssets" stroke="var(--cb-text-subtle)" strokeWidth={2.5} dot={false} strokeDasharray="6 6" />
              </LineChart>
            </ChartContainer>
          </ChartFrame>
        </CompareChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-6 sm:grid-cols-2 xl:grid-cols-4">
        <DeltaCard label="Assets Delta" value="+£290.2m" note="Starling ahead" />
        <DeltaCard label="Cash Delta" value="+£170.0m" note="Higher reserve position" />
        <DeltaCard label="Buyability Delta" value="+12" note="Clear lead on acquisition fit" />
        <DeltaCard label="Scale Signal" value="1.52x" note="Assets multiple vs Monzo" />
      </div>
    </div>
  );
}

const summaryBlueSurface = {
  background: "color-mix(in oklch, var(--cb-neutral-0) 82%, var(--astronaut-50) 18%)",
};

function CompanySummaryCard({
  name,
  companyNumber,
  tone,
  metrics,
}: {
  name: string;
  companyNumber: string;
  tone: "blue" | "slate";
  metrics: [string, string][];
}) {
  const toneClasses = tone === "blue" ? "border-[var(--astronaut-200)]" : "border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)]";

  return (
    <section className={`cb-card rounded-3xl p-6 ${toneClasses}`} style={tone === "blue" ? summaryBlueSurface : undefined}>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">Selected company</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{name}</h2>
          <p className="mt-1 text-sm font-medium text-[var(--cb-text-muted)]">Co. {companyNumber}</p>
        </div>
        <button className="cb-pill rounded-full p-2 text-[var(--cb-text-subtle)] transition-colors hover:text-[var(--astronaut-700)]">
          <Swap weight="bold" className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)]/70 p-4">
            <p className="text-xs font-medium text-[var(--cb-text-subtle)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompareChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="cb-card flex min-h-[320px] flex-col rounded-3xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[var(--cb-text-strong)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--cb-text-subtle)]">Simple comparison view across both selected entities</p>
        </div>
        <div className="rounded-full bg-[var(--astronaut-50)] px-3 py-1 text-xs font-semibold text-[var(--astronaut-700)]">
          5Y
        </div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function ChartFrame({ children }: { children: React.ReactNode }) {
  return <div className="h-[240px] w-full min-w-0">{children}</div>;
}

function DeltaCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <section className="cb-card rounded-2xl p-5">
      <p className="text-xs font-medium text-[var(--cb-text-subtle)]">{label}</p>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{value}</p>
          <p className="mt-1 text-sm text-[var(--cb-text-muted)]">{note}</p>
        </div>
        <div className="rounded-full bg-[var(--astronaut-100)] p-2 text-[var(--astronaut-700)]">
          <ArrowUpRight weight="bold" className="h-4 w-4" />
        </div>
      </div>
    </section>
  );
}

function CompareTooltip({ active, payload, label, prefix = "", suffix = "" }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-[var(--cb-text-strong)] px-3 py-2 text-xs text-white shadow-xl">
        <p className="mb-1 font-semibold text-white/70">{label}</p>
        {payload.map((entry: { dataKey: string; value: number; color: string }) => (
          <p key={entry.dataKey} className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>
              {entry.dataKey}: {prefix}
              {entry.value}
              {suffix}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}
