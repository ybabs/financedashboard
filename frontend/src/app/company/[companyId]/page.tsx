"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import {
    CartesianGrid,
    Line,
    LineChart,
    type TooltipContentProps,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    FinancialSeriesResponse,
    PscItem,
    getFinancialMetricCatalog,
    getFinancialSeries,
} from "@/lib/api";
import {
    formatCompactCurrency,
    formatDate,
    formatInteger,
    formatRatio,
} from "@/lib/format";
import { formatPscKind } from "@/lib/psc";
import { useCompanyData } from "./company-context";
import { PscDetailDrawer } from "./psc-detail-drawer";

type SeriesState = {
    companyId: string;
    supportedMetrics: string[];
    seriesMap: Record<string, FinancialSeriesResponse>;
    error: string | null;
    loaded: boolean;
};

const EMPTY_SERIES_MAP: Record<string, FinancialSeriesResponse> = {};
const EMPTY_SUPPORTED_METRICS: string[] = [];

type MetricConfig = {
    key: string;
    title: string;
    lineColor: string;
    description?: string;
};

type MetricCardConfig = {
    key: string;
    label: string;
    formatter: "currency" | "ratio" | "integer" | "date";
};

type MetricGroupConfig = {
    key: string;
    title: string;
    description: string;
    metrics: string[];
};

type ResolvedMetric = {
    value: string | number | null | undefined;
    periodDate?: string | null;
    source: "series" | "overview" | "detail" | "derived" | "none";
};

const profitabilityCharts: MetricConfig[] = [
    { key: "turnover", title: "Turnover Trend", lineColor: "#3265c1", description: "Revenue and top-line momentum" },
    { key: "operating_profit", title: "Operating Profit", lineColor: "#4d90e2", description: "Operating performance before financing and tax" },
    { key: "profit_before_tax", title: "Profit Before Tax", lineColor: "#68a5ea", description: "Pre-tax earnings trend" },
    { key: "net_profit", title: "Net Profit", lineColor: "#7cb8f0", description: "Bottom-line performance after tax" },
];

const balanceSheetCharts: MetricConfig[] = [
    { key: "net_assets", title: "Net Assets", lineColor: "#2f5f9f", description: "Equity value over time" },
    { key: "fixed_assets", title: "Fixed Assets", lineColor: "#4275b7", description: "Long-term asset base" },
    { key: "cash", title: "Cash Position", lineColor: "#5a91d0", description: "Cash at bank and in hand" },
    { key: "net_current_assets", title: "Net Current Assets", lineColor: "#84b7eb", description: "Working capital after current liabilities" },
];

const headlineCards: MetricCardConfig[] = [
    { key: "turnover", label: "Turnover", formatter: "currency" },
    { key: "operating_profit", label: "Operating Profit", formatter: "currency" },
    { key: "profit_before_tax", label: "Profit Before Tax", formatter: "currency" },
    { key: "net_profit", label: "Net Profit", formatter: "currency" },
    { key: "net_assets", label: "Net Assets", formatter: "currency" },
    { key: "current_ratio", label: "Current Ratio", formatter: "ratio" },
];

const workingCapitalCards: MetricCardConfig[] = [
    { key: "cash", label: "Cash", formatter: "currency" },
    { key: "current_assets", label: "Current Assets", formatter: "currency" },
    { key: "creditors", label: "Current Liabilities", formatter: "currency" },
    { key: "net_current_assets", label: "Net Current Assets", formatter: "currency" },
    { key: "fixed_assets", label: "Fixed Assets", formatter: "currency" },
    { key: "investments", label: "Investments", formatter: "currency" },
    { key: "debtors", label: "Debtors", formatter: "currency" },
    { key: "trade_debtors", label: "Trade Debtors", formatter: "currency" },
    { key: "trade_creditors", label: "Trade Creditors", formatter: "currency" },
    { key: "other_debtors", label: "Other Debtors", formatter: "currency" },
    { key: "other_creditors", label: "Other Creditors", formatter: "currency" },
    { key: "deferred_tax", label: "Deferred Tax", formatter: "currency" },
    { key: "employees", label: "Employees", formatter: "integer" },
];

const balanceSheetGroups: MetricGroupConfig[] = [
    {
        key: "assets",
        title: "Assets",
        description: "Headline asset balances and liquidity",
        metrics: ["cash", "current_assets", "fixed_assets", "investments", "net_current_assets"],
    },
    {
        key: "debtors",
        title: "Debtors",
        description: "Receivables and debtor breakdowns",
        metrics: ["debtors", "trade_debtors", "other_debtors"],
    },
    {
        key: "creditors",
        title: "Creditors",
        description: "Current liabilities and creditor breakdowns",
        metrics: ["creditors", "trade_creditors", "other_creditors", "deferred_tax"],
    },
    {
        key: "people",
        title: "People",
        description: "Workforce data reported in the filing",
        metrics: ["employees"],
    },
];

export default function CompanyDashboardPage() {
    const { companyId, overview, detail, psc } = useCompanyData();
    const router = useRouter();
    const [selectedPscKey, setSelectedPscKey] = useState<string | null>(null);
    const [isPscDrawerOpen, setIsPscDrawerOpen] = useState(false);
    const [seriesState, setSeriesState] = useState<SeriesState>(() => ({
        companyId,
        supportedMetrics: [],
        seriesMap: {},
        error: null,
        loaded: false,
    }));

    useEffect(() => {
        let isActive = true;

        getFinancialMetricCatalog()
            .then(async (catalog) => {
                const supported = new Set(catalog.items.map((item) => item.metric_key));
                const requestedMetrics = Array.from(new Set([
                    ...profitabilityCharts.map((item) => item.key),
                    ...balanceSheetCharts.map((item) => item.key),
                    ...headlineCards.map((item) => item.key),
                    ...workingCapitalCards.map((item) => item.key),
                ])).filter((metricKey) => supported.has(metricKey));
                const requests = requestedMetrics.map(async (metricKey) => [
                    metricKey,
                    await getFinancialSeries(companyId, metricKey),
                ] as const);
                const results = await Promise.all(requests);
                if (!isActive) {
                    return;
                }
                setSeriesState({
                    companyId,
                    supportedMetrics: requestedMetrics,
                    seriesMap: Object.fromEntries(results),
                    error: null,
                    loaded: true,
                });
            })
            .catch((fetchError) => {
                if (!isActive) {
                    return;
                }
                setSeriesState({
                    companyId,
                    supportedMetrics: [],
                    seriesMap: {},
                    error: fetchError instanceof Error ? fetchError.message : "Failed to load financial series",
                    loaded: true,
                });
            });

        return () => {
            isActive = false;
        };
    }, [companyId]);

    const isCurrentSeries = seriesState.companyId === companyId;
    const supportedMetrics = isCurrentSeries ? seriesState.supportedMetrics : EMPTY_SUPPORTED_METRICS;
    const seriesMap = isCurrentSeries ? seriesState.seriesMap : EMPTY_SERIES_MAP;
    const seriesError = isCurrentSeries ? seriesState.error : null;
    const seriesLoading = !isCurrentSeries || !seriesState.loaded;

    const profitabilityCards = useMemo(
        () =>
            profitabilityCharts
                .filter((chart) => supportedMetrics.includes(chart.key))
                .map((chart) => ({
                    ...chart,
                    series: seriesMap[chart.key]?.points ?? [],
                })),
        [seriesMap, supportedMetrics],
    );

    const visibleProfitabilityCards = useMemo(
        () => profitabilityCards.filter((card) => card.series.length > 1),
        [profitabilityCards],
    );

    const balanceSheetTrendCards = useMemo(
        () =>
            balanceSheetCharts
                .filter((chart) => supportedMetrics.includes(chart.key))
                .map((chart) => ({
                    ...chart,
                    series: seriesMap[chart.key]?.points ?? [],
                })),
        [seriesMap, supportedMetrics],
    );

    const visibleBalanceSheetTrendCards = useMemo(
        () => balanceSheetTrendCards.filter((card) => card.series.length >= 3),
        [balanceSheetTrendCards],
    );

    const summaryCards = useMemo(
        () =>
            headlineCards.map((card) => ({
                ...card,
                resolved: resolveMetricValue(card.key, { overview, detail, seriesMap }),
            })),
        [detail, overview, seriesMap],
    );

    const visibleSummaryCards = useMemo(
        () => summaryCards.filter((card) => hasMetricValue(card.resolved.value)),
        [summaryCards],
    );

    const balanceCards = useMemo(
        () =>
            workingCapitalCards.map((card) => ({
                ...card,
                resolved: resolveMetricValue(card.key, { overview, detail, seriesMap }),
            })),
        [detail, overview, seriesMap],
    );

    const visibleBalanceCards = useMemo(
        () => balanceCards.filter((card) => hasMetricValue(card.resolved.value)),
        [balanceCards],
    );

    const groupedBalanceCards = useMemo(
        () =>
            balanceSheetGroups
                .map((group) => ({
                    ...group,
                    cards: group.metrics
                        .map((metricKey) => balanceCards.find((card) => card.key === metricKey))
                        .filter((card): card is (typeof balanceCards)[number] => Boolean(card))
                        .filter((card) => hasMetricValue(card.resolved.value)),
                }))
                .filter((group) => group.cards.length > 0),
        [balanceCards],
    );

    const activePscKey = useMemo(
        () => (selectedPscKey && psc.some((item) => item.psc_key === selectedPscKey) ? selectedPscKey : psc[0]?.psc_key ?? null),
        [psc, selectedPscKey],
    );

    const selectedPsc = useMemo(
        () => psc.find((item) => item.psc_key === activePscKey) ?? psc[0] ?? null,
        [activePscKey, psc],
    );

    const latestVisibleFinancialFactDate = useMemo(() => {
        const resolvedPeriods = [
            ...summaryCards.map((card) => card.resolved),
            ...balanceCards.map((card) => card.resolved),
        ]
            .filter((metric) => metric.source !== "none" && metric.periodDate && metric.periodDate !== detail?.last_accounts_made_up_to)
            .map((metric) => metric.periodDate as string);

        if (resolvedPeriods.length === 0) {
            return null;
        }

        return resolvedPeriods.reduce((latest, current) => (current > latest ? current : latest));
    }, [balanceCards, detail?.last_accounts_made_up_to, summaryCards]);

    const accountsMadeUpTo = detail?.last_accounts_made_up_to ?? overview?.last_accounts_made_up_to ?? null;
    const hasFinancialDataLag =
        Boolean(accountsMadeUpTo) &&
        Boolean(latestVisibleFinancialFactDate) &&
        accountsMadeUpTo! > latestVisibleFinancialFactDate!;

    const openPscListPage = () => {
        router.push(`/company/${encodeURIComponent(companyId)}/psc`);
    };

    return (
        <div className="flex h-full w-full flex-col space-y-6 pb-6">
            <PscDetailDrawer
                item={selectedPsc}
                companyNumber={companyId}
                open={isPscDrawerOpen}
                onClose={() => setIsPscDrawerOpen(false)}
            />

            {hasFinancialDataLag ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                    Financial facts currently loaded for this company only run to {formatDate(latestVisibleFinancialFactDate)}, while the company profile shows accounts made up to {formatDate(accountsMadeUpTo)}.
                </div>
            ) : null}

            {visibleSummaryCards.length > 0 ? (
                <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    {visibleSummaryCards.map((card) => (
                        <MetricCard
                            key={card.key}
                            label={card.label}
                            value={formatMetricValue(card.resolved.value, card.formatter)}
                            hint={metricHint(card.resolved, card.formatter)}
                        />
                    ))}
                </section>
            ) : null}

            <section className={`grid grid-cols-1 gap-6 ${visibleProfitabilityCards.length > 0 ? "xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]" : "xl:grid-cols-[minmax(0,900px)]"}`}>
                {visibleProfitabilityCards.length > 0 ? (
                    <BentoCard
                        title="Profitability"
                        subtitle="Headline earnings trends built from the financial metric catalog"
                    >
                        <div className="grid h-full grid-cols-1 gap-5 md:grid-cols-2">
                            {visibleProfitabilityCards.map((card) => (
                                <TrendCard
                                    key={card.key}
                                    title={card.title}
                                    subtitle={card.description}
                                    color={card.lineColor}
                                    data={card.series}
                                    loading={seriesLoading}
                                    error={seriesError}
                                />
                            ))}
                        </div>
                    </BentoCard>
                ) : null}

                <BentoCard
                    title="PSC Snapshot"
                    action={<ArrowUpRight className="w-4 h-4" />}
                    onActionClick={openPscListPage}
                >
                    <div className="flex h-full flex-col justify-between gap-6">
                        <div>
                            <div className="text-[72px] font-light leading-none tracking-tighter text-[#1c1c1c]">
                                {formatInteger(overview?.psc_count ?? psc.length)}
                            </div>
                            <button
                                type="button"
                                onClick={openPscListPage}
                                className="mt-3 inline-flex items-center rounded-full bg-[#dfedfa] px-3 py-1 text-sm font-medium text-[#5193e0] transition-colors hover:bg-[#d4e8fb]"
                            >
                                <ChartLineUp weight="bold" className="mr-1" />
                                People with significant control
                            </button>
                        </div>
                        <div className="space-y-3">
                            {psc.length > 0 ? (
                                psc.slice(0, 4).map((item) => (
                                    <PscCard
                                        key={item.psc_key}
                                        item={item}
                                        isSelected={activePscKey === item.psc_key}
                                        onSelect={(pscKey) => {
                                            setSelectedPscKey(pscKey);
                                            setIsPscDrawerOpen(true);
                                        }}
                                    />
                                ))
                            ) : (
                                <div className="rounded-2xl bg-[#f4f6f8] px-4 py-4 text-sm text-[#6b7280]">
                                    No PSC entries returned for this company.
                                </div>
                            )}
                        </div>
                    </div>
                </BentoCard>
            </section>

            {visibleBalanceCards.length > 0 ? (
                <section className="space-y-4">
                    <SectionHeader
                        title="Balance Sheet and Working Capital"
                        subtitle="Latest available values from the overview payload or the normalized series read model"
                    />
                    <div className="space-y-6">
                        {groupedBalanceCards.map((group) => (
                            <MetricGroup
                                key={group.key}
                                title={group.title}
                                description={group.description}
                                cards={group.cards}
                            />
                        ))}
                    </div>
                </section>
            ) : null}

            {visibleBalanceSheetTrendCards.length > 0 ? (
                <section className="space-y-4">
                    <SectionHeader
                        title="Balance Sheet Trends"
                        subtitle="Longer-running capital structure and liquidity series"
                    />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {visibleBalanceSheetTrendCards.map((card) => (
                            <BentoCard
                                key={card.key}
                                title={card.title}
                                subtitle={card.series[card.series.length - 1]?.period_date
                                    ? `Updated ${formatDate(card.series[card.series.length - 1].period_date)}`
                                    : card.description}
                            >
                                <ChartPanel
                                    color={card.lineColor}
                                    data={card.series}
                                    loading={seriesLoading}
                                    error={seriesError}
                                />
                            </BentoCard>
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}

function getSeriesPoint(
    metricKey: string,
    seriesMap: Record<string, FinancialSeriesResponse>,
    targetPeriodDate: string | null,
) {
    const points = seriesMap[metricKey]?.points ?? [];
    if (points.length === 0) {
        return null;
    }
    if (targetPeriodDate) {
        const exactPoint = points.find((point) => point.period_date === targetPeriodDate);
        if (exactPoint) {
            return exactPoint;
        }
    }
    return points[points.length - 1] ?? null;
}

function resolveMetricValue(
    metricKey: string,
    {
        overview,
        detail,
        seriesMap,
    }: {
        overview: ReturnType<typeof useCompanyData>["overview"];
        detail: ReturnType<typeof useCompanyData>["detail"];
        seriesMap: Record<string, FinancialSeriesResponse>;
    },
): ResolvedMetric {
    const accountsMadeUpTo = detail?.last_accounts_made_up_to ?? overview?.last_accounts_made_up_to ?? null;

    if (metricKey === "current_ratio") {
        const currentAssetsPoint = getSeriesPoint("current_assets", seriesMap, accountsMadeUpTo);
        const creditorsPoint = getSeriesPoint("creditors", seriesMap, accountsMadeUpTo);
        if (currentAssetsPoint && creditorsPoint) {
            const currentAssetsValue = Number(currentAssetsPoint.value);
            const creditorsValue = Number(creditorsPoint.value);
            if (Number.isFinite(currentAssetsValue) && Number.isFinite(creditorsValue) && creditorsValue !== 0) {
                return {
                    value: currentAssetsValue / creditorsValue,
                    periodDate: currentAssetsPoint.period_date === creditorsPoint.period_date ? currentAssetsPoint.period_date : null,
                    source: "derived",
                };
            }
        }
        return {
            value: overview?.current_ratio,
            periodDate: overview?.current_ratio == null ? null : accountsMadeUpTo,
            source: "derived",
        };
    }

    const selectedPoint = getSeriesPoint(metricKey, seriesMap, accountsMadeUpTo);
    if (selectedPoint) {
        return {
            value: selectedPoint.value,
            periodDate: selectedPoint.period_date,
            source: "series",
        };
    }

    const overviewValue = overview?.[metricKey as keyof typeof overview];
    if (overviewValue !== undefined && overviewValue !== null) {
        return {
            value: overviewValue,
            periodDate: accountsMadeUpTo,
            source: "overview",
        };
    }

    const detailValue = detail?.[metricKey as keyof typeof detail];
    if (detailValue !== undefined && detailValue !== null) {
        return {
            value: detailValue,
            periodDate: accountsMadeUpTo,
            source: "detail",
        };
    }

    return {
        value: null,
        periodDate: null,
        source: "none",
    };
}

function hasMetricValue(value: string | number | null | undefined): boolean {
    return value !== null && value !== undefined && value !== "";
}

function formatMetricValue(
    value: string | number | null | undefined,
    formatter: MetricCardConfig["formatter"],
): string {
    switch (formatter) {
        case "currency":
            return formatCompactCurrency(value);
        case "ratio":
            return formatRatio(typeof value === "number" ? value : value == null ? null : Number(value));
        case "integer":
            return formatInteger(typeof value === "number" ? value : value == null ? null : Number(value));
        case "date":
            return formatDate(typeof value === "string" ? value : value == null ? null : String(value));
        default:
            return "—";
    }
}

function metricHint(resolved: ResolvedMetric, formatter: MetricCardConfig["formatter"]): string | undefined {
    if (formatter === "date" || !resolved.periodDate || !hasMetricValue(resolved.value)) {
        return undefined;
    }
    return `As of ${formatDate(resolved.periodDate)}`;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="flex items-end justify-between gap-4">
            <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f8a98]">{title}</h2>
                <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p>
            </div>
        </div>
    );
}

function BentoCard({
    title,
    subtitle,
    children,
    action,
    onActionClick,
}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
    onActionClick?: () => void;
}) {
    return (
        <div className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-sm font-semibold text-[#1c1c1c] tracking-tight">{title}</h3>
                    {subtitle ? <p className="mt-1 text-xs text-[#8c8c8c]">{subtitle}</p> : null}
                </div>
                {action && (
                    <button
                        type="button"
                        onClick={onActionClick}
                        className="text-[#a0a0a0] hover:text-[#1c1c1c] transition-colors"
                    >
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

function TrendCard({
    title,
    subtitle,
    data,
    color,
    loading,
    error,
}: {
    title: string;
    subtitle?: string;
    data: FinancialSeriesResponse["points"];
    color: string;
    loading: boolean;
    error: string | null;
}) {
    return (
        <div className="flex min-h-[220px] flex-col rounded-[22px] border border-[#eef2f7] bg-[#fbfcfe] p-5">
            <div className="mb-4">
                <div className="text-sm font-semibold text-[#1c1c1c]">{title}</div>
                {subtitle ? <div className="mt-1 text-xs text-[#8c8c8c]">{subtitle}</div> : null}
            </div>
            <div className="min-h-0 flex-1">
                <ChartPanel color={color} data={data} loading={loading} error={error} />
            </div>
        </div>
    );
}

function PscCard({
    item,
    isSelected,
    onSelect,
}: {
    item: PscItem;
    isSelected: boolean;
    onSelect: (pscKey: string) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onSelect(item.psc_key)}
            className={`flex w-full items-start justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                isSelected
                    ? "border-[#cdddf4] bg-[#eef4fb]"
                    : "border-[#eef2f7] bg-[#f4f6f8] hover:border-[#dbe6f4] hover:bg-[#eef4fb]"
            }`}
            aria-label={`Open PSC details for ${item.name}`}
        >
            <div className="min-w-0">
                <div className="text-sm font-semibold text-[#1c1c1c]">{item.name}</div>
                <div className="mt-1 text-xs text-[#6b7280]">{formatPscKind(item.kind)}</div>
                <div className="mt-1 text-xs text-[#8c8c8c]">{item.nationality ?? "Nationality unavailable"}</div>
            </div>
            <ArrowRight className="ml-4 mt-0.5 h-4 w-4 shrink-0 text-[#9aa4b2]" />
        </button>
    );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="flex min-h-[118px] flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-shadow hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div>
                <span className="text-xs font-medium text-[#8c8c8c]">{label}</span>
                {hint ? <div className="mt-1 text-[11px] text-[#a0a0a0]">{hint}</div> : null}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-[#1c1c1c] tracking-tight">{value}</span>
            </div>
        </div>
    );
}

function MetricGroup({
    title,
    description,
    cards,
}: {
    title: string;
    description: string;
    cards: Array<{
        key: string;
        label: string;
        formatter: MetricCardConfig["formatter"];
        resolved: ResolvedMetric;
    }>;
}) {
    return (
        <div className="space-y-3">
            <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">{title}</h3>
                <p className="mt-1 text-sm text-[#6b7280]">{description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {cards.map((card) => (
                    <MetricCard
                        key={card.key}
                        label={card.label}
                        value={formatMetricValue(card.resolved.value, card.formatter)}
                        hint={metricHint(card.resolved, card.formatter)}
                    />
                ))}
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

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#1c1c1c] text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-white/10">
                <p className="font-semibold text-white/70 mb-1">{label}</p>
                <p className="font-bold text-lg">{formatCompactCurrency(payload[0]?.value)}</p>
            </div>
        );
    }
    return null;
}
