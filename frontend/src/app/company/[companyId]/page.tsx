"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    FinancialSeriesResponse,
    getFinancialMetricCatalog,
    getFinancialSeries,
} from "@/lib/api";
import {
    formatCompactCurrency,
    formatDate,
    formatInteger,
    formatRatio,
} from "@/lib/format";
import { useCompanyData } from "./company-context";

type ChartConfig = {
    key: "net_profit" | "assets" | "cash";
    title: string;
    lineColor: string;
};

const preferredCharts: ChartConfig[] = [
    { key: "net_profit", title: "Net Profit Trend", lineColor: "#5193e0" },
    { key: "assets", title: "Total Assets Growth", lineColor: "#3365c2" },
    { key: "cash", title: "Cash Position", lineColor: "#72b1e8" },
];

export default function CompanyDashboardPage() {
    const { companyId, overview, detail, psc } = useCompanyData();
    const [seriesMap, setSeriesMap] = useState<Record<string, FinancialSeriesResponse>>({});
    const [seriesLoading, setSeriesLoading] = useState(true);
    const [seriesError, setSeriesError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;
        setSeriesLoading(true);
        setSeriesError(null);

        getFinancialMetricCatalog()
            .then(async (catalog) => {
                const supported = new Set(catalog.items.map((item) => item.metric_key));
                const requests = preferredCharts
                    .filter((chart) => supported.has(chart.key))
                    .map(async (chart) => [chart.key, await getFinancialSeries(companyId, chart.key)] as const);
                const results = await Promise.all(requests);
                if (!isActive) {
                    return;
                }
                setSeriesMap(Object.fromEntries(results));
            })
            .catch((fetchError) => {
                if (!isActive) {
                    return;
                }
                setSeriesMap({});
                setSeriesError(
                    fetchError instanceof Error ? fetchError.message : "Failed to load financial series",
                );
            })
            .finally(() => {
                if (isActive) {
                    setSeriesLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [companyId]);

    const cards = useMemo(
        () =>
            preferredCharts.map((chart) => ({
                ...chart,
                series: seriesMap[chart.key]?.points ?? [],
            })),
        [seriesMap],
    );

    return (
        <div className="flex flex-col h-full w-full space-y-6">

            {/* 2x2 GRID FOR CHARTS */}
            <div className="grid grid-cols-2 gap-6 h-[460px] shrink-0">

                {cards.map((card) => (
                    <BentoCard
                        key={card.key}
                        title={card.title}
                        subtitle={card.series[card.series.length - 1]?.period_date
                            ? `Updated ${formatDate(card.series[card.series.length - 1].period_date)}`
                            : undefined}
                    >
                        <ChartPanel
                            color={card.lineColor}
                            data={card.series}
                            loading={seriesLoading}
                            error={seriesError}
                        />
                    </BentoCard>
                ))}

                <BentoCard title="PSC Snapshot" action={<ArrowUpRight className="w-4 h-4" />}>
                    <div className="flex h-full flex-col justify-between">
                        <div>
                            <div className="text-[72px] font-light leading-none tracking-tighter text-[#1c1c1c]">
                                {formatInteger(overview?.psc_count ?? psc.length)}
                            </div>
                            <div className="mt-3 inline-flex items-center rounded-full bg-[#dfedfa] px-3 py-1 text-sm font-medium text-[#5193e0]">
                                <ChartLineUp weight="bold" className="mr-1" />
                                People with significant control
                            </div>
                        </div>
                        <div className="space-y-3">
                            {psc.length > 0 ? (
                                psc.slice(0, 3).map((item) => (
                                    <div
                                        key={item.psc_key}
                                        className="rounded-2xl bg-[#f4f6f8] px-4 py-3"
                                    >
                                        <div className="text-sm font-semibold text-[#1c1c1c]">{item.name}</div>
                                        <div className="mt-1 text-xs text-[#6b7280]">
                                            {item.kind}
                                            {item.nationality ? ` • ${item.nationality}` : ""}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="rounded-2xl bg-[#f4f6f8] px-4 py-4 text-sm text-[#6b7280]">
                                    No PSC entries returned for this company.
                                </div>
                            )}
                        </div>
                    </div>
                </BentoCard>
            </div>

            {/* BOTTOM METRICS ROW */}
            <div className="grid grid-cols-5 gap-4 shrink-0 pb-6">
                <MetricCard label="Turnover" value={formatCompactCurrency(overview?.turnover ?? detail?.turnover)} />
                <MetricCard label="Cash in Bank" value={formatCompactCurrency(overview?.cash ?? detail?.cash)} />
                <MetricCard label="Current Ratio" value={formatRatio(overview?.current_ratio)} />
                <MetricCard label="Employees" value={formatInteger(overview?.employees ?? detail?.employees)} />
                <MetricCard
                    label="Accounts Made Up To"
                    value={detail?.last_accounts_made_up_to ? formatDate(detail.last_accounts_made_up_to) : "—"}
                />
            </div>

        </div>
    );
}

// --- SUB-COMPONENTS ---

function BentoCard({
    title,
    subtitle,
    children,
    action,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-sm font-semibold text-[#1c1c1c] tracking-tight">{title}</h3>
                    {subtitle ? <p className="mt-1 text-xs text-[#8c8c8c]">{subtitle}</p> : null}
                </div>
                {action && (
                    <button className="text-[#a0a0a0] hover:text-[#1c1c1c] transition-colors">
                        {action}
                    </button>
                )}
            </div>
            <div className="flex-1 min-h-0 relative z-10">
                {children}
            </div>
        </div>
    );
}

function MetricCard({ label, value }: { label: string, value: string }) {
    return (
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-5 flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-shadow">
            <span className="text-xs font-medium text-[#8c8c8c]">{label}</span>
            <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-[#1c1c1c] tracking-tight">{value}</span>
            </div>
        </div>
    );
}

function ChartPanel({
    data,
    color,
    loading,
    error,
}: {
    data: FinancialSeriesResponse["points"];
    color: string;
    loading: boolean;
    error: string | null;
}) {
    if (loading) {
        return <EmptyPanel label="Loading financial series..." />;
    }
    if (error) {
        return <EmptyPanel label={error} />;
    }
    if (!data.length) {
        return <EmptyPanel label="No time-series data available." />;
    }

    const chartData = data.map((point) => ({
        period: new Date(point.period_date).getFullYear().toString(),
        value: Number(point.value),
    }));

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#dbe6f4", strokeWidth: 2 }} />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 2 }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
}

function EmptyPanel({ label }: { label: string }) {
    return (
        <div className="flex h-full items-center justify-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            {label}
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#1c1c1c] text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-white/10">
                <p className="font-semibold text-white/70 mb-1">{label}</p>
                <p className="font-bold text-lg">{formatCompactCurrency(payload[0].value)}</p>
            </div>
        );
    }
    return null;
};
