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
    CompanyOfficerItem,
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
import { formatMetricLabel, type MetricFormatter } from "@/lib/financials";
import { formatOfficerName, formatOfficerRole } from "@/lib/officers";
import { formatPscKind } from "@/lib/psc";
import { useCompanyData } from "./company-context";
import { MetricDetailDrawer } from "./metric-detail-drawer";
import { OfficerDetailDrawer } from "./officer-detail-drawer";
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
    formatter: MetricFormatter;
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
    { key: "current_assets", title: "Current Assets", lineColor: "#376aa9", description: "Short-term assets across filings" },
    { key: "creditors", title: "Current Liabilities", lineColor: "#4e82bf", description: "Amounts due within one year over time" },
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
    const { companyId, overview, detail, psc, officers, officersSourceFiling } = useCompanyData();
    const router = useRouter();
    const [selectedPscKey, setSelectedPscKey] = useState<string | null>(null);
    const [isPscDrawerOpen, setIsPscDrawerOpen] = useState(false);
    const [selectedOfficerKey, setSelectedOfficerKey] = useState<string | null>(null);
    const [isOfficerDrawerOpen, setIsOfficerDrawerOpen] = useState(false);
    const [selectedMetricKey, setSelectedMetricKey] = useState<string | null>(null);
    const [isMetricDrawerOpen, setIsMetricDrawerOpen] = useState(false);
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
                const results = await Promise.allSettled(
                    requestedMetrics.map(async (metricKey) => [
                        metricKey,
                        await getFinancialSeries(companyId, metricKey),
                    ] as const),
                );
                if (!isActive) {
                    return;
                }

                const successful = results
                    .filter((result): result is PromiseFulfilledResult<readonly [string, FinancialSeriesResponse]> => result.status === "fulfilled")
                    .map((result) => result.value);
                const firstError = results.find((result) => result.status === "rejected");

                setSeriesState({
                    companyId,
                    supportedMetrics: requestedMetrics,
                    seriesMap: Object.fromEntries(successful),
                    error: successful.length === 0
                        ? firstError?.reason instanceof Error
                            ? firstError.reason.message
                            : "Failed to load financial series"
                        : null,
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
    const financialRecency = overview?.financial_recency ?? detail?.financial_recency ?? null;
    const companyAccountsMadeUpTo =
        financialRecency?.company_accounts_made_up_to ??
        detail?.last_accounts_made_up_to ??
        overview?.last_accounts_made_up_to ??
        null;
    const officersReportedDate =
        officersSourceFiling?.current_period_date ??
        officersSourceFiling?.period_instant ??
        officersSourceFiling?.period_end ??
        null;
    const latestSeriesPeriodDate = useMemo(() => getLatestSeriesPeriodDate(seriesMap), [seriesMap]);
    const latestMetricPeriodDate = financialRecency?.latest_metric_period_date ?? latestSeriesPeriodDate;
    const latestFilingBackedDate =
        financialRecency?.latest_filing_backed_period_date ??
        pickLatestIsoDate(latestMetricPeriodDate, officersReportedDate);
    const effectiveAccountsMadeUpTo =
        financialRecency?.effective_accounts_made_up_to ??
        pickLatestIsoDate(companyAccountsMadeUpTo, latestFilingBackedDate);
    const financialRecencySource = financialRecency?.source ?? "unknown";

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
                resolved: resolveMetricValue(card.key, {
                    overview,
                    detail,
                    seriesMap,
                    companyPeriodDate: companyAccountsMadeUpTo,
                    latestMetricPeriodDate,
                    effectivePeriodDate: effectiveAccountsMadeUpTo,
                    financialRecencySource,
                }),
            })),
        [companyAccountsMadeUpTo, detail, effectiveAccountsMadeUpTo, financialRecencySource, latestMetricPeriodDate, overview, seriesMap],
    );

    const visibleSummaryCards = useMemo(
        () => summaryCards.filter((card) => hasMetricValue(card.resolved.value)),
        [summaryCards],
    );

    const balanceCards = useMemo(
        () =>
            workingCapitalCards.map((card) => ({
                ...card,
                resolved: resolveMetricValue(card.key, {
                    overview,
                    detail,
                    seriesMap,
                    companyPeriodDate: companyAccountsMadeUpTo,
                    latestMetricPeriodDate,
                    effectivePeriodDate: effectiveAccountsMadeUpTo,
                    financialRecencySource,
                }),
            })),
        [companyAccountsMadeUpTo, detail, effectiveAccountsMadeUpTo, financialRecencySource, latestMetricPeriodDate, overview, seriesMap],
    );

    const visibleBalanceCards = useMemo(
        () => balanceCards.filter((card) => hasMetricValue(card.resolved.value)),
        [balanceCards],
    );

    const metricConfigByKey = useMemo(
        () =>
            new Map(
                [...headlineCards, ...workingCapitalCards].map((item) => [
                    item.key,
                    { label: item.label, formatter: item.formatter },
                ]),
            ),
        [],
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

    const activeOfficerKey = useMemo(
        () => (
            selectedOfficerKey && officers.some((item) => item.officer_key === selectedOfficerKey)
                ? selectedOfficerKey
                : officers[0]?.officer_key ?? null
        ),
        [officers, selectedOfficerKey],
    );

    const selectedOfficer = useMemo(
        () => officers.find((item) => item.officer_key === activeOfficerKey) ?? officers[0] ?? null,
        [activeOfficerKey, officers],
    );

    const activeMetricKey = useMemo(
        () => (selectedMetricKey && metricConfigByKey.has(selectedMetricKey) ? selectedMetricKey : null),
        [metricConfigByKey, selectedMetricKey],
    );

    const selectedMetricConfig = useMemo(
        () => (activeMetricKey ? metricConfigByKey.get(activeMetricKey) ?? null : null),
        [activeMetricKey, metricConfigByKey],
    );

    const selectedMetricResolved = useMemo(() => {
        if (!activeMetricKey) {
            return null;
        }
        return (
            summaryCards.find((item) => item.key === activeMetricKey)?.resolved ??
            balanceCards.find((item) => item.key === activeMetricKey)?.resolved ??
            null
        );
    }, [activeMetricKey, balanceCards, summaryCards]);

    const hasFinancialDateMismatch =
        Boolean(companyAccountsMadeUpTo) &&
        Boolean(latestFilingBackedDate) &&
        companyAccountsMadeUpTo !== latestFilingBackedDate;
    const officersSectionSubtitle = officersReportedDate
        ? `Reported in the latest available filing as of ${formatDate(officersReportedDate)}`
        : "Board and officer details will appear here when available";

    const openPscListPage = () => {
        router.push(`/company/${encodeURIComponent(companyId)}/psc`);
    };

    const openFilingHistoryPage = () => {
        router.push(`/company/${encodeURIComponent(companyId)}/filings`);
    };

    const openHistoricalViewPage = (metricKey?: string | null) => {
        const params = new URLSearchParams();
        if (metricKey) {
            params.set("metric", metricKey);
        }
        const query = params.toString();
        router.push(`/company/${encodeURIComponent(companyId)}/financials${query ? `?${query}` : ""}`);
    };

    return (
        <div className="flex h-full w-full flex-col space-y-8 pb-8">
            <PscDetailDrawer
                item={selectedPsc}
                companyNumber={companyId}
                open={isPscDrawerOpen}
                onClose={() => setIsPscDrawerOpen(false)}
            />
            <OfficerDetailDrawer
                item={selectedOfficer}
                sourceFiling={officersSourceFiling}
                open={isOfficerDrawerOpen}
                onClose={() => setIsOfficerDrawerOpen(false)}
                onOpenFilingHistory={openFilingHistoryPage}
            />
            <MetricDetailDrawer
                companyNumber={companyId}
                metricKey={activeMetricKey}
                metricLabel={selectedMetricConfig?.label ?? (activeMetricKey ? formatMetricLabel(activeMetricKey) : "Metric")}
                formatter={selectedMetricConfig?.formatter ?? "currency"}
                currentValue={selectedMetricResolved?.value}
                currentPeriodDate={selectedMetricResolved?.periodDate}
                open={isMetricDrawerOpen}
                onClose={() => setIsMetricDrawerOpen(false)}
                onOpenFilingHistory={openFilingHistoryPage}
                onOpenHistoricalView={openHistoricalViewPage}
            />

            {hasFinancialDateMismatch ? (
                <div className="rounded-xl bg-[#fff6e6] px-5 py-4 text-sm text-[#8a5b12] shadow-[0_12px_32px_rgba(23,28,31,0.04)]">
                    The company profile currently shows accounts made up to {formatDate(companyAccountsMadeUpTo)}, but the latest filing-backed period for this company runs to {formatDate(latestFilingBackedDate)}.
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
                            onClick={() => {
                                setSelectedMetricKey(card.key);
                                setIsMetricDrawerOpen(true);
                            }}
                        />
                    ))}
                </section>
            ) : null}

            <section className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.95fr)] xl:items-start">
                <div className="space-y-8">
                    <BentoCard
                        title="Filing History"
                        subtitle="Review the latest filing, open a filing-specific snapshot, and compare changes across periods."
                        action={<ArrowUpRight className="h-4 w-4" />}
                        onActionClick={openFilingHistoryPage}
                    >
                        <div className="flex h-full flex-col justify-between gap-6 md:flex-row md:items-end">
                            <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
                                <ContextStat
                                    label="Accounts made up to"
                                    value={effectiveAccountsMadeUpTo ? formatDate(effectiveAccountsMadeUpTo) : "Unavailable"}
                                />
                                <ContextStat
                                    label="Latest financial facts"
                                    value={latestMetricPeriodDate ? formatDate(latestMetricPeriodDate) : "Unavailable"}
                                />
                                <ContextStat
                                    label="Compare periods"
                                    value="Open filing history"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={openFilingHistoryPage}
                                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#00288e] to-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(23,28,31,0.08)] transition-opacity hover:opacity-90"
                            >
                                <ArrowUpRight className="h-4 w-4" />
                                Open filing history
                            </button>
                        </div>
                    </BentoCard>

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

                    {visibleBalanceCards.length > 0 ? (
                        <section className="space-y-4">
                            <SectionHeader
                                title="Balance Sheet and Working Capital"
                                subtitle="Latest available values from the overview payload or the normalized series read model"
                                actionLabel="Open historical view"
                                onActionClick={() => openHistoricalViewPage(null)}
                            />
                            <div className="space-y-6">
                                {groupedBalanceCards.map((group) => (
                                    <MetricGroup
                                        key={group.key}
                                        title={group.title}
                                        description={group.description}
                                        cards={group.cards}
                                        onSelectMetric={(metricKey) => {
                                            setSelectedMetricKey(metricKey);
                                            setIsMetricDrawerOpen(true);
                                        }}
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
                                actionLabel="Open trends mode"
                                onActionClick={() => openHistoricalViewPage(visibleBalanceSheetTrendCards[0]?.key ?? "net_assets")}
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
                                        <div className="h-[220px] min-h-[220px]">
                                            <ChartPanel
                                                color={card.lineColor}
                                                data={card.series}
                                                loading={seriesLoading}
                                                error={seriesError}
                                            />
                                        </div>
                                    </BentoCard>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </div>

                <aside className="space-y-8">
                    <BentoCard
                        title="PSC Snapshot"
                        subtitle="Beneficial ownership and control at a glance"
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
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--cb-neutral-2)] px-3 py-2 text-sm font-semibold text-[var(--cb-text-body)] transition-colors hover:bg-[var(--cb-neutral-3)]"
                                >
                                    <ChartLineUp weight="bold" className="h-4 w-4" />
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

                    <BentoCard
                        title="Directors and Officers"
                        subtitle={officersSectionSubtitle}
                        action={<ArrowUpRight className="h-4 w-4" />}
                        onActionClick={openFilingHistoryPage}
                    >
                        <div className="space-y-4">
                            <div className="text-sm font-semibold text-[#1c1c1c]">
                                {officers.length > 0 ? `${officers.length} reported ${officers.length === 1 ? "officer" : "officers"}` : "Director and officer details are not currently available"}
                            </div>

                            {officers.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {officers.map((item) => (
                                        <OfficerCard
                                            key={item.officer_key}
                                            item={item}
                                            isSelected={activeOfficerKey === item.officer_key}
                                            onSelect={(officerKey) => {
                                                setSelectedOfficerKey(officerKey);
                                                setIsOfficerDrawerOpen(true);
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl bg-[var(--cb-neutral-2)] px-4 py-5 text-sm text-[var(--cb-text-muted)]">
                                    We&apos;ll show board and officer information here when it becomes available from filings or registry records.
                                </div>
                            )}
                        </div>
                    </BentoCard>
                </aside>
            </section>
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
    const latestPoint = points[points.length - 1] ?? null;
    if (targetPeriodDate) {
        const exactPoint = points.find((point) => point.period_date === targetPeriodDate);
        if (exactPoint && latestPoint && latestPoint.period_date <= targetPeriodDate) {
            return exactPoint;
        }
    }
    return latestPoint;
}

function getLatestSeriesPeriodDate(seriesMap: Record<string, FinancialSeriesResponse>): string | null {
    const periodDates = Object.values(seriesMap)
        .flatMap((series) => series.points.map((point) => point.period_date))
        .filter(Boolean);
    if (periodDates.length === 0) {
        return null;
    }
    return periodDates.reduce((latest, current) => (current > latest ? current : latest));
}

function pickLatestIsoDate(left: string | null, right: string | null): string | null {
    if (!left) {
        return right;
    }
    if (!right) {
        return left;
    }
    return right > left ? right : left;
}

function resolveMetricValue(
    metricKey: string,
    {
        overview,
        detail,
        seriesMap,
        companyPeriodDate,
        latestMetricPeriodDate,
        effectivePeriodDate,
        financialRecencySource,
    }: {
        overview: ReturnType<typeof useCompanyData>["overview"];
        detail: ReturnType<typeof useCompanyData>["detail"];
        seriesMap: Record<string, FinancialSeriesResponse>;
        companyPeriodDate: string | null;
        latestMetricPeriodDate: string | null;
        effectivePeriodDate: string | null;
        financialRecencySource: "company" | "filing_backed" | "aligned" | "unknown";
    },
): ResolvedMetric {
    const selectedPoint = getSeriesPoint(metricKey, seriesMap, latestMetricPeriodDate ?? effectivePeriodDate);
    const overviewValue = overview?.[metricKey as keyof typeof overview];
    const detailValue = detail?.[metricKey as keyof typeof detail];
    const shouldPreferFilingBackedSeries = financialRecencySource === "filing_backed";

    if (metricKey === "current_ratio") {
        const currentAssetsPoint = getSeriesPoint("current_assets", seriesMap, latestMetricPeriodDate ?? effectivePeriodDate);
        const creditorsPoint = getSeriesPoint("creditors", seriesMap, latestMetricPeriodDate ?? effectivePeriodDate);
        if (shouldPreferFilingBackedSeries && currentAssetsPoint && creditorsPoint) {
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
        if (overview?.current_ratio !== undefined && overview?.current_ratio !== null) {
            return {
                value: overview.current_ratio,
                periodDate: shouldPreferFilingBackedSeries
                    ? latestMetricPeriodDate ?? effectivePeriodDate
                    : companyPeriodDate ?? latestMetricPeriodDate ?? effectivePeriodDate,
                source: "derived",
            };
        }
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
            value: null,
            periodDate: null,
            source: "derived",
        };
    }

    if (shouldPreferFilingBackedSeries && selectedPoint) {
        return {
            value: selectedPoint.value,
            periodDate: selectedPoint.period_date,
            source: "series",
        };
    }

    if (detailValue !== undefined && detailValue !== null && financialRecencySource !== "filing_backed") {
        return {
            value: detailValue,
            periodDate: companyPeriodDate ?? effectivePeriodDate,
            source: "detail",
        };
    }

    if (overviewValue !== undefined && overviewValue !== null) {
        return {
            value: overviewValue,
            periodDate: shouldPreferFilingBackedSeries
                ? latestMetricPeriodDate ?? effectivePeriodDate
                : latestMetricPeriodDate ?? companyPeriodDate ?? effectivePeriodDate,
            source: "overview",
        };
    }

    if (selectedPoint) {
        return {
            value: selectedPoint.value,
            periodDate: selectedPoint.period_date,
            source: "series",
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
    formatter: MetricFormatter,
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

function metricHint(resolved: ResolvedMetric, formatter: MetricFormatter): string | undefined {
    if (formatter === "date" || !resolved.periodDate || !hasMetricValue(resolved.value)) {
        return undefined;
    }
    return `As of ${formatDate(resolved.periodDate)}`;
}

function SectionHeader({
    title,
    subtitle,
    actionLabel,
    onActionClick,
}: {
    title: string;
    subtitle: string;
    actionLabel?: string;
    onActionClick?: () => void;
}) {
    return (
        <div className="flex items-end justify-between gap-4">
            <div>
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--cb-text-subtle)]">{title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cb-text-muted)]">{subtitle}</p>
            </div>
            {actionLabel && onActionClick ? (
                <button
                    type="button"
                    onClick={onActionClick}
                    className="inline-flex items-center gap-2 rounded-lg border border-[rgba(0,40,142,0.16)] bg-[var(--cb-neutral-0)] px-4 py-2.5 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:bg-[var(--cb-neutral-1)]"
                >
                    <ChartLineUp className="h-4 w-4" />
                    {actionLabel}
                </button>
            ) : null}
        </div>
    );
}

function ContextStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl bg-[var(--cb-neutral-2)] px-4 py-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--cb-text-subtle)]">{label}</div>
            <div className="mt-2 text-lg font-semibold tracking-tight text-[var(--cb-text-strong)] tabular-nums">{value}</div>
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
        <div className="relative flex flex-col overflow-hidden rounded-xl bg-[var(--cb-neutral-0)] p-6 shadow-[0_12px_32px_rgba(23,28,31,0.06)] ring-1 ring-[rgba(196,197,213,0.15)]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">{title}</h3>
                    {subtitle ? <p className="mt-2 text-sm leading-6 text-[var(--cb-text-muted)]">{subtitle}</p> : null}
                </div>
                {action && (
                    <button
                        type="button"
                        onClick={onActionClick}
                        className="rounded-lg p-2 text-[var(--cb-text-subtle)] transition-colors hover:bg-[var(--cb-neutral-2)] hover:text-[var(--cb-text-strong)]"
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
        <div className="flex min-h-[220px] flex-col rounded-xl bg-[var(--cb-neutral-2)] p-5">
            <div className="mb-4">
                <div className="text-base font-semibold text-[var(--cb-text-strong)]">{title}</div>
                {subtitle ? <div className="mt-2 text-xs uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">{subtitle}</div> : null}
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
            className={`flex w-full items-start justify-between rounded-xl px-4 py-4 text-left transition-colors ${
                isSelected
                    ? "bg-[var(--cb-neutral-2)] shadow-[inset_0_0_0_1px_rgba(0,40,142,0.14)]"
                    : "bg-[var(--cb-neutral-1)] hover:bg-[var(--cb-neutral-2)]"
            }`}
            aria-label={`Open PSC details for ${item.name}`}
        >
            <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--cb-text-strong)]">{item.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">{formatPscKind(item.kind)}</div>
                <div className="mt-2 text-xs text-[var(--cb-text-muted)]">{item.nationality ?? "Nationality unavailable"}</div>
            </div>
            <ArrowRight className="ml-4 mt-0.5 h-4 w-4 shrink-0 text-[var(--cb-text-subtle)]" />
        </button>
    );
}

function OfficerCard({
    item,
    isSelected,
    onSelect,
}: {
    item: CompanyOfficerItem;
    isSelected: boolean;
    onSelect: (officerKey: string) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onSelect(item.officer_key)}
            className={`flex w-full items-start justify-between rounded-xl px-4 py-4 text-left transition-colors ${
                isSelected
                    ? "bg-[var(--cb-neutral-2)] shadow-[inset_0_0_0_1px_rgba(0,40,142,0.14)]"
                    : "bg-[var(--cb-neutral-1)] hover:bg-[var(--cb-neutral-2)]"
            }`}
            aria-label={`Open officer details for ${item.name}`}
        >
            <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--cb-text-strong)]">{formatOfficerName(item.name)}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">{formatOfficerRole(item.role)}</div>
                <div className="mt-2 text-xs text-[var(--cb-text-muted)]">
                    {item.reported_period_date ? `Reported in filing as of ${formatDate(item.reported_period_date)}` : "Reported in latest filing"}
                </div>
            </div>
            <ArrowRight className="ml-4 mt-0.5 h-4 w-4 shrink-0 text-[var(--cb-text-subtle)]" />
        </button>
    );
}

function MetricCard({
    label,
    value,
    hint,
    onClick,
}: {
    label: string;
    value: string;
    hint?: string;
    onClick?: () => void;
}) {
    const className = "flex min-h-[128px] flex-col justify-between rounded-xl bg-[var(--cb-neutral-0)] p-5 text-left shadow-[0_12px_32px_rgba(23,28,31,0.05)] ring-1 ring-[rgba(196,197,213,0.15)] transition-shadow hover:shadow-[0_14px_36px_rgba(23,28,31,0.07)]";

    const content = (
        <>
            <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">{label}</span>
                {hint ? <div className="mt-2 text-[12px] text-[var(--cb-text-muted)] tabular-nums">{hint}</div> : null}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
                <span className="tabular-nums text-3xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{value}</span>
            </div>
        </>
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`${className} cursor-pointer`}>
                {content}
            </button>
        );
    }

    return <div className={className}>{content}</div>;
}

function MetricGroup({
    title,
    description,
    cards,
    onSelectMetric,
}: {
    title: string;
    description: string;
    cards: Array<{
        key: string;
        label: string;
        formatter: MetricCardConfig["formatter"];
        resolved: ResolvedMetric;
    }>;
    onSelectMetric?: (metricKey: string) => void;
}) {
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--cb-text-subtle)]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--cb-text-muted)]">{description}</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {cards.map((card) => (
                    <MetricCard
                        key={card.key}
                        label={card.label}
                        value={formatMetricValue(card.resolved.value, card.formatter)}
                        hint={metricHint(card.resolved, card.formatter)}
                        onClick={onSelectMetric ? () => onSelectMetric(card.key) : undefined}
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
                <CartesianGrid stroke="rgba(23,28,31,0.06)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} tick={{ fill: "#7d889d", fontSize: 12 }} />
                <YAxis hide domain={["auto", "auto"]} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(0,40,142,0.12)", strokeWidth: 2 }} />
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
        <div className="flex h-full items-center justify-center rounded-xl bg-[var(--cb-neutral-1)] text-sm text-[var(--cb-text-muted)]">
            {label}
        </div>
    );
}

function CustomTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
    if (active && payload && payload.length) {
        return (
            <div className="rounded-xl bg-[rgba(255,255,255,0.8)] px-3 py-2 text-xs shadow-[0_12px_32px_rgba(23,28,31,0.08)] backdrop-blur-[16px]">
                <p className="mb-1 font-semibold text-[var(--cb-text-subtle)]">{label}</p>
                <p className="tabular-nums text-lg font-bold text-[var(--cb-text-strong)]">{formatCompactCurrency(payload[0]?.value)}</p>
            </div>
        );
    }
    return null;
}
