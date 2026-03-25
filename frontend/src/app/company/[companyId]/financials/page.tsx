"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ChartLineUp,
} from "@phosphor-icons/react/dist/ssr";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";

import {
  type CompanyMetricDetailResponse,
  getCompanyMetricDetail,
  getFinancialMetricCatalog,
} from "@/lib/api";
import {
  formatCompactCurrency,
  formatDate,
  formatInteger,
  formatRatio,
} from "@/lib/format";
import { formatMetricLabel, type MetricFormatter } from "@/lib/financials";
import { useCompanyData } from "../company-context";

type MetricOption = {
  key: string;
  label: string;
  formatter: MetricFormatter;
  description: string;
};

type CatalogState = {
  companyId: string;
  supportedMetricKeys: string[];
  error: string | null;
  loaded: boolean;
};

type MetricDetailState = {
  companyId: string;
  metricKey: string;
  payload: CompanyMetricDetailResponse | null;
  error: string | null;
  loaded: boolean;
};

type FilingComparisonRow = {
  periodLabel: string;
  sourcePath: string;
  value: string | number;
  periodDate: string | null;
  sourceCount: number;
  compareToLabel: string | null;
  delta: number | null;
  deltaPct: number | null;
};

type HistorySignal = {
  title: string;
  body: string;
  tone: "blue" | "slate";
};

const METRIC_OPTIONS: MetricOption[] = [
  { key: "net_assets", label: "Net Assets", formatter: "currency", description: "Equity and solvency across filing periods." },
  { key: "current_ratio", label: "Current Ratio", formatter: "ratio", description: "Liquidity coverage of current liabilities." },
  { key: "current_assets", label: "Current Assets", formatter: "currency", description: "Short-term resources available within one year." },
  { key: "creditors", label: "Current Liabilities", formatter: "currency", description: "Amounts due within one year." },
  { key: "cash", label: "Cash", formatter: "currency", description: "Cash at bank and in hand." },
  { key: "turnover", label: "Turnover", formatter: "currency", description: "Top-line revenue where filings expose it." },
  { key: "operating_profit", label: "Operating Profit", formatter: "currency", description: "Operating performance before financing and tax." },
  { key: "profit_before_tax", label: "Profit Before Tax", formatter: "currency", description: "Pre-tax earnings trend." },
  { key: "net_profit", label: "Net Profit", formatter: "currency", description: "Bottom-line performance after tax." },
  { key: "net_current_assets", label: "Net Current Assets", formatter: "currency", description: "Working capital after current liabilities." },
  { key: "fixed_assets", label: "Fixed Assets", formatter: "currency", description: "Long-term asset base over time." },
  { key: "debtors", label: "Debtors", formatter: "currency", description: "Receivables and debtor exposure." },
  { key: "trade_debtors", label: "Trade Debtors", formatter: "currency", description: "Trade receivables across filings." },
  { key: "trade_creditors", label: "Trade Creditors", formatter: "currency", description: "Trade payables across filings." },
  { key: "employees", label: "Employees", formatter: "integer", description: "Reported workforce counts." },
];

export default function CompanyFinancialsHistoryPage() {
  const { companyId, detail, overview } = useCompanyData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const metricParam = searchParams.get("metric")?.trim().toLowerCase() ?? null;
  const displayName = detail?.name ?? overview?.name ?? companyId;

  const [catalogState, setCatalogState] = useState<CatalogState>({
    companyId,
    supportedMetricKeys: [],
    error: null,
    loaded: false,
  });
  const [metricDetailState, setMetricDetailState] = useState<MetricDetailState>({
    companyId,
    metricKey: "",
    payload: null,
    error: null,
    loaded: false,
  });

  useEffect(() => {
    let active = true;

    getFinancialMetricCatalog()
      .then((payload) => {
        if (!active) {
          return;
        }
        setCatalogState({
          companyId,
          supportedMetricKeys: payload.items.map((item) => item.metric_key),
          error: null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setCatalogState({
          companyId,
          supportedMetricKeys: [],
          error: error instanceof Error ? error.message : "Failed to load supported financial metrics",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyId]);

  const availableMetrics = useMemo(() => {
    const supportedMetricKeys =
      catalogState.companyId === companyId && catalogState.loaded
        ? catalogState.supportedMetricKeys
        : [];
    if (!supportedMetricKeys.length) {
      return METRIC_OPTIONS;
    }
    return METRIC_OPTIONS.filter((item) => supportedMetricKeys.includes(item.key));
  }, [catalogState, companyId]);

  const selectedMetric = useMemo(() => {
    if (!availableMetrics.length) {
      return null;
    }
    if (metricParam) {
      const matchingMetric = availableMetrics.find((item) => item.key === metricParam);
      if (matchingMetric) {
        return matchingMetric;
      }
    }
    return availableMetrics[0];
  }, [availableMetrics, metricParam]);

  useEffect(() => {
    if (!selectedMetric) {
      return;
    }
    if (metricParam === selectedMetric.key) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", selectedMetric.key);
    router.replace(`/company/${encodeURIComponent(companyId)}/financials?${params.toString()}`, { scroll: false });
  }, [companyId, metricParam, router, searchParams, selectedMetric]);

  useEffect(() => {
    let active = true;

    if (!selectedMetric) {
      return () => {
        active = false;
      };
    }

    getCompanyMetricDetail(companyId, selectedMetric.key)
      .then((payload) => {
        if (!active) {
          return;
        }
        setMetricDetailState({
          companyId,
          metricKey: selectedMetric.key,
          payload,
          error: null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setMetricDetailState({
          companyId,
          metricKey: selectedMetric.key,
          payload: null,
          error: error instanceof Error ? error.message : "Failed to load historical metric detail",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyId, selectedMetric]);

  const payload =
    metricDetailState.companyId === companyId && metricDetailState.metricKey === (selectedMetric?.key ?? "")
      ? metricDetailState.payload
      : null;
  const metricError =
    metricDetailState.companyId === companyId && metricDetailState.metricKey === (selectedMetric?.key ?? "")
      ? metricDetailState.error
      : null;
  const metricLoading =
    Boolean(selectedMetric) &&
    (metricDetailState.companyId !== companyId ||
      metricDetailState.metricKey !== (selectedMetric?.key ?? "") ||
      !metricDetailState.loaded);

  const orderedFilings = useMemo(
    () =>
      [...(payload?.filings ?? [])].sort((left, right) => {
        const leftKey = left.period_date ?? left.filing.current_period_date ?? "";
        const rightKey = right.period_date ?? right.filing.current_period_date ?? "";
        if (leftKey !== rightKey) {
          return rightKey.localeCompare(leftKey);
        }
        return right.filing.document_id - left.filing.document_id;
      }),
    [payload?.filings],
  );

  const comparisonRows = useMemo<FilingComparisonRow[]>(
    () =>
      orderedFilings.map((item, index) => {
        const previous = orderedFilings[index + 1] ?? null;
        const value = coerceNumber(item.value);
        const previousValue = previous ? coerceNumber(previous.value) : null;
        const delta = value !== null && previousValue !== null ? value - previousValue : null;
        const deltaPct =
          delta !== null && previousValue !== null && previousValue !== 0
            ? delta / previousValue
            : null;

        return {
          periodLabel: formatDate(item.period_date ?? item.filing.current_period_date),
          sourcePath: item.filing.source_path,
          value: item.value,
          periodDate: item.period_date ?? item.filing.current_period_date,
          sourceCount: item.source_count,
          compareToLabel: previous ? formatDate(previous.period_date ?? previous.filing.current_period_date) : null,
          delta,
          deltaPct,
        };
      }),
    [orderedFilings],
  );

  const hasEnoughFilingHistory = comparisonRows.length >= 3;

  const observedSignals = useMemo<HistorySignal[]>(() => {
    if (comparisonRows.length < 2 || !selectedMetric) {
      return [];
    }

    const first = comparisonRows[0];
    const last = comparisonRows[comparisonRows.length - 1];
    const firstValue = coerceNumber(first.value);
    const lastValue = coerceNumber(last.value);
    const signals: HistorySignal[] = [];

    if (firstValue !== null && lastValue !== null) {
      const overallDelta = firstValue - lastValue;
      const overallDeltaPct = lastValue !== 0 ? overallDelta / lastValue : null;
      signals.push({
        title: "Whole-history move",
        body:
          `${selectedMetric.label} is ${overallDelta > 0 ? "up" : overallDelta < 0 ? "down" : "flat"} ` +
          `${formatMetricDelta(overallDelta, selectedMetric.formatter)} versus ${last.periodLabel}` +
          (overallDeltaPct !== null ? ` (${formatPercent(overallDeltaPct)}).` : "."),
        tone: "blue",
      });
    }

    const largestStep = comparisonRows
      .filter((item) => item.delta !== null && item.compareToLabel)
      .sort((left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0))[0];
    if (largestStep) {
      signals.push({
        title: "Largest filing-to-filing move",
        body:
          `${formatMetricDelta(largestStep.delta, selectedMetric.formatter)} between ${largestStep.compareToLabel} and ${largestStep.periodLabel}` +
          (largestStep.deltaPct !== null ? ` (${formatPercent(largestStep.deltaPct)}).` : "."),
        tone: "slate",
      });
    }

    const numericValues = comparisonRows
      .map((item) => ({ item, numericValue: coerceNumber(item.value) }))
      .filter((item): item is { item: FilingComparisonRow; numericValue: number } => item.numericValue !== null);
    if (numericValues.length >= 2) {
      const highest = numericValues.reduce((best, current) => (current.numericValue > best.numericValue ? current : best));
      const lowest = numericValues.reduce((best, current) => (current.numericValue < best.numericValue ? current : best));
      if (first.periodLabel === highest.item.periodLabel) {
        signals.push({
          title: "Current position",
          body: `The latest filing is the highest observed point in this ${numericValues.length}-filing history.`,
          tone: "blue",
        });
      } else if (first.periodLabel === lowest.item.periodLabel) {
        signals.push({
          title: "Current position",
          body: `The latest filing is the lowest observed point in this ${numericValues.length}-filing history.`,
          tone: "slate",
        });
      }
    }

    return signals.slice(0, 3);
  }, [comparisonRows, selectedMetric]);

  const latestPoint = comparisonRows[0] ?? null;
  const earliestPoint = comparisonRows[comparisonRows.length - 1] ?? null;

  return (
    <div className="flex h-full w-full flex-col space-y-6 pb-6">
      <section className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f8a98]">
              Historical View
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b7280]">
              Compare one normalized financial metric across multiple filing-backed periods for {displayName}. This view
              is designed for 3+ filing comparison on a single metric.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push(`/company/${encodeURIComponent(companyId)}`)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#dbe3ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] transition-colors hover:border-[#c3d5ea] hover:bg-[#fbfcfe]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to company
            </button>
            <button
              type="button"
              onClick={() => router.push(`/company/${encodeURIComponent(companyId)}/filings`)}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#00288e] to-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(23,28,31,0.08)] transition-opacity hover:opacity-90"
            >
              <ArrowUpRight className="h-4 w-4" />
              Open filing history
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-semibold text-[#1c1c1c]">Metric selection</h3>
              <p className="mt-1 text-sm text-[#6b7280]">
                Choose a metric to compare across filing periods and the normalized time series.
              </p>
            </div>

            {catalogState.error && !availableMetrics.length ? (
              <EmptyState
                title="Financial metric catalog unavailable"
                description={catalogState.error}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableMetrics.map((metric) => (
                  <button
                    key={metric.key}
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("metric", metric.key);
                      router.replace(`/company/${encodeURIComponent(companyId)}/financials?${params.toString()}`, {
                        scroll: false,
                      });
                    }}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                      selectedMetric?.key === metric.key
                        ? "border-[#cdddf4] bg-[#eef4fb] text-[#2f5f9f]"
                        : "border-[#e7edf5] bg-white text-[#5b6674] hover:border-[#d9e3ef] hover:bg-[#f8fbff]"
                    }`}
                  >
                    {metric.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedMetric ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
            <div className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight text-[#1c1c1c]">{selectedMetric.label}</h3>
                    <p className="mt-1 text-sm text-[#6b7280]">{selectedMetric.description}</p>
                  </div>
                  <div className="rounded-2xl bg-[#f8fafc] px-4 py-3 text-sm text-[#475569]">
                    {hasEnoughFilingHistory
                      ? `Ready to compare ${comparisonRows.length} filing-backed periods.`
                      : `Only ${comparisonRows.length} filing-backed period${comparisonRows.length === 1 ? "" : "s"} available for this metric.`}
                  </div>
                </div>

                {metricLoading ? (
                  <EmptyState title="Loading historical view..." description="Reading filing-backed values and normalized series for the selected metric." />
                ) : metricError ? (
                  <EmptyState title="Historical metric view unavailable" description={metricError} />
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <SummaryCard
                        label="Latest value"
                        value={formatMetricValue(latestPoint?.value, selectedMetric.formatter)}
                        hint={latestPoint ? `As of ${latestPoint.periodLabel}` : "No value"}
                      />
                      <SummaryCard
                        label="Filing-backed periods"
                        value={formatInteger(comparisonRows.length)}
                        hint={comparisonRows.length >= 3 ? "Sufficient for multi-period compare" : "Need 3+ for full compare mode"}
                      />
                      <SummaryCard
                        label="History span"
                        value={
                          latestPoint && earliestPoint
                            ? `${earliestPoint.periodLabel} to ${latestPoint.periodLabel}`
                            : "Unavailable"
                        }
                        hint={payload?.series.length ? `${payload.series.length} normalized series point${payload.series.length === 1 ? "" : "s"}` : "No normalized series"}
                      />
                      <SummaryCard
                        label="Supporting tags"
                        value={formatInteger((payload?.tags ?? []).length)}
                        hint={payload?.derived_from.length ? `Derived from ${payload.derived_from.map((item) => formatMetricLabel(item)).join(" and ")}` : "Direct metric mapping"}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
                      <div className="rounded-2xl border border-[#e7edf5] bg-[#fbfcfe] p-5">
                        <div className="mb-4">
                          <div className="text-sm font-semibold text-[#1c1c1c]">Series history</div>
                          <div className="mt-1 text-sm text-[#6b7280]">
                            Normalized read-model history for this metric across observed periods.
                          </div>
                        </div>
                        <div className="h-[300px]">
                          <HistoricalChart
                            formatter={selectedMetric.formatter}
                            data={payload?.series ?? []}
                          />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#e7edf5] bg-[#fbfcfe] p-5">
                          <div className="mb-4 flex items-center gap-2">
                            <ChartLineUp className="h-4 w-4 text-[#2f5f9f]" />
                            <div className="text-sm font-semibold text-[#1c1c1c]">Observed signals</div>
                          </div>
                          {observedSignals.length ? (
                            <div className="space-y-3">
                              {observedSignals.map((signal) => (
                                <SignalCard key={signal.title} signal={signal} />
                              ))}
                            </div>
                          ) : (
                            <EmptyCompact label="Not enough history yet to summarize structural movements." />
                          )}
                        </div>

                        <div className="rounded-2xl border border-[#e7edf5] bg-[#fbfcfe] p-5">
                          <div className="text-sm font-semibold text-[#1c1c1c]">Mapped tags</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(payload?.tags ?? []).length ? (
                              (payload?.tags ?? []).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-[11px] font-medium text-[#2f5f9f]"
                                >
                                  {formatTagLabel(tag)}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-[#6b7280]">No supporting tags returned for this metric.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                <div className="mb-5">
                  <h3 className="text-sm font-semibold text-[#1c1c1c]">3+ filing comparison</h3>
                  <p className="mt-1 text-sm text-[#6b7280]">
                    Filing-backed values for {selectedMetric.label}, ordered from newest to oldest, with change versus the prior filing period.
                  </p>
                </div>

                {metricLoading ? (
                  <EmptyState title="Loading filing comparison..." description="Waiting for filing-backed values for this metric." />
                ) : metricError ? (
                  <EmptyState title="Filing comparison unavailable" description={metricError} />
                ) : !comparisonRows.length ? (
                  <EmptyState title="No filing-backed values returned" description="This metric does not currently have filing-specific values to compare." />
                ) : !hasEnoughFilingHistory ? (
                  <EmptyState
                    title="Not enough filing-backed history yet"
                    description={`This metric currently has ${comparisonRows.length} filing-backed period${comparisonRows.length === 1 ? "" : "s"}. Compare mode becomes useful at 3 or more.`}
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#e7edf5]">
                    <div className="grid grid-cols-[minmax(120px,0.95fr)_minmax(120px,0.9fr)_minmax(130px,1fr)_minmax(140px,1fr)_minmax(90px,0.7fr)_minmax(220px,1.5fr)] gap-4 bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7f8a98]">
                      <div>Period</div>
                      <div>Value</div>
                      <div>Compared to</div>
                      <div>Change</div>
                      <div>Sources</div>
                      <div>Filing</div>
                    </div>
                    {comparisonRows.map((row) => (
                      <ComparisonRow
                        key={`${row.periodDate ?? row.periodLabel}:${row.sourcePath}`}
                        row={row}
                        formatter={selectedMetric.formatter}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                <div className="text-sm font-semibold text-[#1c1c1c]">Current metric context</div>
                <div className="mt-4">
                  <div className="tabular-nums text-4xl font-semibold tracking-tight text-[#1c1c1c]">
                    {metricLoading
                      ? "…"
                      : formatMetricValue(payload?.latest_value ?? null, selectedMetric.formatter)}
                  </div>
                  <div className="mt-2 text-sm text-[#6b7280]">
                    {payload?.latest_period_date
                      ? `Latest filing-backed point as of ${formatDate(payload.latest_period_date)}`
                      : "No latest filing-backed point returned"}
                  </div>
                </div>
                {payload?.latest_filing ? (
                  <div className="mt-5 rounded-2xl bg-[#f8fafc] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7f8a98]">
                      Latest filing source
                    </div>
                    <div className="mt-2 break-all text-sm font-medium text-[#334155]">
                      {payload.latest_filing.source_path}
                    </div>
                    <div className="mt-2 text-xs text-[#6b7280]">
                      {formatDate(payload.latest_filing.current_period_date ?? payload.latest_period_date)}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                <div className="text-sm font-semibold text-[#1c1c1c]">How to read this view</div>
                <div className="mt-4 space-y-3 text-sm leading-6 text-[#6b7280]">
                  <p>
                    The chart uses the normalized financial series read model, while the comparison table uses filing-backed values only.
                  </p>
                  <p>
                    Differences between the two usually reflect missing tags in some filings, derived metrics, or period alignment rules.
                  </p>
                  <p>
                    Use filing history when you need the underlying snapshot or note-level disclosures for a specific period.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <EmptyState
            title="No supported metrics available"
            description="This environment did not return any supported normalized financial metrics."
          />
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e7edf5] bg-[#fbfcfe] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7f8a98]">{label}</div>
      <div className="mt-3 text-lg font-semibold tracking-tight text-[#1c1c1c]">{value}</div>
      <div className="mt-2 text-xs text-[#6b7280]">{hint}</div>
    </div>
  );
}

function HistoricalChart({
  data,
  formatter,
}: {
  data: CompanyMetricDetailResponse["series"];
  formatter: MetricFormatter;
}) {
  if (!data.length) {
    return <EmptyCompact label="No normalized series points are available for this metric." />;
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
        <Tooltip content={<HistoryTooltip formatter={formatter} />} cursor={{ stroke: "rgba(0,40,142,0.12)", strokeWidth: 2 }} />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#1e40af"
          strokeWidth={3}
          dot={false}
          activeDot={{ r: 5, fill: "#1e40af", stroke: "#fff", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ComparisonRow({
  row,
  formatter,
}: {
  row: FilingComparisonRow;
  formatter: MetricFormatter;
}) {
  const deltaClass =
    row.delta === null
      ? "text-[#64748b]"
      : row.delta > 0
        ? "text-emerald-700"
        : row.delta < 0
          ? "text-rose-700"
          : "text-[#334155]";

  return (
    <div className="grid grid-cols-[minmax(120px,0.95fr)_minmax(120px,0.9fr)_minmax(130px,1fr)_minmax(140px,1fr)_minmax(90px,0.7fr)_minmax(220px,1.5fr)] gap-4 border-t border-[#eef2f7] bg-white px-4 py-4 text-sm">
      <div className="font-medium text-[#1c1c1c]">{row.periodLabel}</div>
      <div className="tabular-nums text-[#334155]">{formatMetricValue(row.value, formatter)}</div>
      <div className="text-[#475569]">{row.compareToLabel ?? "—"}</div>
      <div className={deltaClass}>
        {formatMetricDelta(row.delta, formatter)}
        {row.deltaPct !== null ? <span className="ml-2 text-xs text-[#8c8c8c]">({formatPercent(row.deltaPct)})</span> : null}
      </div>
      <div className="text-[#475569]">{row.sourceCount}</div>
      <div className="truncate text-[#64748b]">{row.sourcePath}</div>
    </div>
  );
}

function SignalCard({ signal }: { signal: HistorySignal }) {
  const toneClass =
    signal.tone === "blue"
      ? "bg-[#eef4fb] text-[#173f72]"
      : "bg-[#f8fafc] text-[#475569]";

  return (
    <div className={`rounded-2xl px-4 py-4 ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">{signal.title}</div>
      <div className="mt-2 text-sm leading-6">{signal.body}</div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9e1ea] bg-[#f8fafc] px-5 py-8">
      <div className="text-sm font-semibold text-[#1c1c1c]">{title}</div>
      <div className="mt-2 text-sm text-[#6b7280]">{description}</div>
    </div>
  );
}

function EmptyCompact({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl bg-[#f1f5f9] px-4 text-sm text-[#64748b]">
      {label}
    </div>
  );
}

function HistoryTooltip({
  active,
  payload,
  label,
  formatter,
}: TooltipContentProps<number, string> & { formatter: MetricFormatter }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="rounded-xl bg-[rgba(255,255,255,0.8)] px-3 py-2 text-xs shadow-[0_12px_32px_rgba(23,28,31,0.08)] backdrop-blur-[16px]">
      <p className="mb-1 font-semibold text-[#64748b]">{label}</p>
      <p className="tabular-nums text-lg font-bold text-[#1c1c1c]">
        {formatMetricValue(payload[0]?.value, formatter)}
      </p>
    </div>
  );
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

function formatMetricDelta(
  value: number | null,
  formatter: MetricFormatter,
): string {
  if (value === null) {
    return "—";
  }
  const formatted = formatMetricValue(value, formatter);
  return value > 0 ? `+${formatted}` : formatted;
}

function formatPercent(value: number): string {
  const percentage = value * 100;
  return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`;
}

function formatTagLabel(tag: string): string {
  return tag
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function coerceNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
