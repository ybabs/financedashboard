"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowsLeftRight,
  ArrowSquareOut,
  ChartLineUp,
  MagnifyingGlass,
  TrendUp,
  X,
} from "@phosphor-icons/react/dist/ssr";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  type TooltipPayloadEntry,
  XAxis,
  YAxis,
} from "recharts";

import { ChartContainer } from "@/components/app/chart-container";
import { useCompanyTabs } from "@/components/app/company-tabs-provider";
import {
  type CompanyCompareResponse,
  type CompanyCompareSide,
  type CompanyMetricDetailResponse,
  type CompanySearchResult,
  compareCompanies,
  getCompanyMetricDetail,
  searchCompanies,
} from "@/lib/api";
import {
  formatCompactCurrency,
  formatDate,
  formatInteger,
  formatRatio,
  initialsFromName,
} from "@/lib/format";

type CompareMetricFormatter = "currency" | "ratio" | "integer";

type CompareMetricOption = {
  key: string;
  label: string;
  formatter: CompareMetricFormatter;
  description: string;
};

type CompareMetricState = {
  key: string;
  leftPayload: CompanyMetricDetailResponse | null;
  rightPayload: CompanyMetricDetailResponse | null;
  error: string | null;
  loaded: boolean;
};

type CompareSnapshotState = {
  key: string;
  payload: CompanyCompareResponse | null;
  error: string | null;
  loaded: boolean;
};

type CompareChartPoint = {
  periodDate: string;
  leftValue: number | null;
  rightValue: number | null;
};

type FilingComparisonRow = {
  key: string;
  periodDate: string | null;
  periodLabel: string;
  leftValue: string | number | null;
  rightValue: string | number | null;
  leftSourceCount: number | null;
  rightSourceCount: number | null;
  leftSourcePath: string | null;
  rightSourcePath: string | null;
  delta: number | null;
};

const METRIC_OPTIONS: CompareMetricOption[] = [
  {
    key: "net_assets",
    label: "Net Assets",
    formatter: "currency",
    description: "Solvency and equity across filing-backed periods.",
  },
  {
    key: "current_ratio",
    label: "Current Ratio",
    formatter: "ratio",
    description: "Liquidity coverage of short-term liabilities.",
  },
  {
    key: "current_assets",
    label: "Current Assets",
    formatter: "currency",
    description: "Short-term resources available within one year.",
  },
  {
    key: "creditors",
    label: "Current Liabilities",
    formatter: "currency",
    description: "Amounts due within one year.",
  },
  {
    key: "cash",
    label: "Cash",
    formatter: "currency",
    description: "Cash at bank and in hand.",
  },
  {
    key: "turnover",
    label: "Turnover",
    formatter: "currency",
    description: "Top-line revenue where filings expose it.",
  },
  {
    key: "employees",
    label: "Employees",
    formatter: "integer",
    description: "Reported workforce counts over time.",
  },
];

const SNAPSHOT_ROWS: Array<{
  key: keyof CompanyCompareSide;
  label: string;
  formatter: CompareMetricFormatter;
}> = [
  { key: "turnover", label: "Turnover", formatter: "currency" },
  { key: "net_assets", label: "Net Assets", formatter: "currency" },
  { key: "current_assets", label: "Current Assets", formatter: "currency" },
  { key: "creditors", label: "Current Liabilities", formatter: "currency" },
  { key: "cash", label: "Cash", formatter: "currency" },
  { key: "employees", label: "Employees", formatter: "integer" },
  { key: "psc_count", label: "PSC Count", formatter: "integer" },
  { key: "current_ratio", label: "Current Ratio", formatter: "ratio" },
];

export default function ComparePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tabs } = useCompanyTabs();

  const leftCompanyNumber = normalizeCompanyNumber(searchParams.get("left"));
  const rightCompanyNumber = normalizeCompanyNumber(searchParams.get("right"));
  const metricParam = searchParams.get("metric")?.trim().toLowerCase() ?? null;

  const selectedMetric = METRIC_OPTIONS.find((option) => option.key === metricParam) ?? METRIC_OPTIONS[0];
  const compareKey =
    leftCompanyNumber && rightCompanyNumber ? `${leftCompanyNumber}:${rightCompanyNumber}` : "";
  const metricKey =
    leftCompanyNumber && rightCompanyNumber ? `${compareKey}:${selectedMetric.key}` : "";
  const sameCompanySelected =
    Boolean(leftCompanyNumber) &&
    Boolean(rightCompanyNumber) &&
    leftCompanyNumber === rightCompanyNumber;

  const [selectionLabels, setSelectionLabels] = useState<Record<string, string>>({});
  const [compareState, setCompareState] = useState<CompareSnapshotState>({
    key: "",
    payload: null,
    error: null,
    loaded: false,
  });
  const [metricState, setMetricState] = useState<CompareMetricState>({
    key: "",
    leftPayload: null,
    rightPayload: null,
    error: null,
    loaded: false,
  });

  useEffect(() => {
    if (metricParam === selectedMetric.key) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", selectedMetric.key);
    router.replace(`/compare?${params.toString()}`, { scroll: false });
  }, [metricParam, router, searchParams, selectedMetric.key]);

  useEffect(() => {
    if (!leftCompanyNumber || !rightCompanyNumber || sameCompanySelected) {
      return;
    }

    let active = true;

    compareCompanies(leftCompanyNumber, rightCompanyNumber)
      .then((payload) => {
        if (!active) {
          return;
        }
        setSelectionLabels((current) => ({
          ...current,
          [payload.left.company_number]: payload.left.name,
          [payload.right.company_number]: payload.right.name,
        }));
        setCompareState({
          key: compareKey,
          payload,
          error: null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setCompareState({
          key: compareKey,
          payload: null,
          error: error instanceof Error ? error.message : "Failed to compare companies",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [compareKey, leftCompanyNumber, rightCompanyNumber, sameCompanySelected]);

  useEffect(() => {
    if (!leftCompanyNumber || !rightCompanyNumber || sameCompanySelected) {
      return;
    }

    let active = true;

    Promise.allSettled([
      getCompanyMetricDetail(leftCompanyNumber, selectedMetric.key),
      getCompanyMetricDetail(rightCompanyNumber, selectedMetric.key),
    ])
      .then(([leftResult, rightResult]) => {
        if (!active) {
          return;
        }

        const errors: string[] = [];
        if (leftResult.status === "rejected") {
          errors.push(`Left company: ${leftResult.reason instanceof Error ? leftResult.reason.message : "metric unavailable"}`);
        }
        if (rightResult.status === "rejected") {
          errors.push(`Right company: ${rightResult.reason instanceof Error ? rightResult.reason.message : "metric unavailable"}`);
        }

        setMetricState({
          key: metricKey,
          leftPayload: leftResult.status === "fulfilled" ? leftResult.value : null,
          rightPayload: rightResult.status === "fulfilled" ? rightResult.value : null,
          error: errors.length ? errors.join(" ") : null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setMetricState({
          key: metricKey,
          leftPayload: null,
          rightPayload: null,
          error: error instanceof Error ? error.message : "Failed to load metric comparison",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [leftCompanyNumber, metricKey, rightCompanyNumber, sameCompanySelected, selectedMetric.key]);

  const comparePayload = compareState.key === compareKey ? compareState.payload : null;
  const compareError = compareState.key === compareKey ? compareState.error : null;
  const compareLoading =
    Boolean(compareKey) &&
    !sameCompanySelected &&
    (!compareState.loaded || compareState.key !== compareKey);

  const leftMetricPayload = metricState.key === metricKey ? metricState.leftPayload : null;
  const rightMetricPayload = metricState.key === metricKey ? metricState.rightPayload : null;
  const metricError = metricState.key === metricKey ? metricState.error : null;
  const metricLoading =
    Boolean(metricKey) &&
    !sameCompanySelected &&
    (!metricState.loaded || metricState.key !== metricKey);

  const mergedChartData = useMemo(
    () => mergeMetricSeries(leftMetricPayload, rightMetricPayload),
    [leftMetricPayload, rightMetricPayload],
  );
  const filingComparisonRows = useMemo(
    () => buildFilingComparisonRows(leftMetricPayload, rightMetricPayload),
    [leftMetricPayload, rightMetricPayload],
  );

  const leftTab = tabs.find((tab) => tab.companyNumber === leftCompanyNumber);
  const rightTab = tabs.find((tab) => tab.companyNumber === rightCompanyNumber);
  const leftLabel =
    comparePayload?.left.name ??
    (leftCompanyNumber ? selectionLabels[leftCompanyNumber] : null) ??
    leftTab?.name ??
    leftCompanyNumber;
  const rightLabel =
    comparePayload?.right.name ??
    (rightCompanyNumber ? selectionLabels[rightCompanyNumber] : null) ??
    rightTab?.name ??
    rightCompanyNumber;

  const quickPicks = tabs.filter(
    (tab, index, current) =>
      current.findIndex((candidate) => candidate.companyNumber === tab.companyNumber) === index,
  );

  const latestLeftValue = leftMetricPayload?.latest_value ?? null;
  const latestRightValue = rightMetricPayload?.latest_value ?? null;
  const latestDelta = computeLatestDelta(latestLeftValue, latestRightValue);
  const historyCoverageLabel =
    leftMetricPayload || rightMetricPayload
      ? `${formatInteger(leftMetricPayload?.filings.length ?? 0)} vs ${formatInteger(
          rightMetricPayload?.filings.length ?? 0,
        )} filing-backed periods`
      : "Awaiting metric histories";
  const periodAlignmentLabel =
    leftMetricPayload?.latest_period_date || rightMetricPayload?.latest_period_date
      ? `${formatDate(leftMetricPayload?.latest_period_date)} vs ${formatDate(rightMetricPayload?.latest_period_date)}`
      : "No latest periods returned";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value.trim()) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    const query = params.toString();
    router.replace(query ? `/compare?${query}` : "/compare", { scroll: false });
  }

  function handleSelect(side: "left" | "right", result: CompanySearchResult) {
    const companyNumber = result.company_number.trim().toUpperCase();
    const companyName = result.name.trim() || companyNumber;
    setSelectionLabels((current) => ({
      ...current,
      [companyNumber]: companyName,
    }));
    updateParams({ [side]: companyNumber });
  }

  function handleClear(side: "left" | "right") {
    updateParams({ [side]: null });
  }

  function handleSwap() {
    if (!leftCompanyNumber && !rightCompanyNumber) {
      return;
    }
    updateParams({
      left: rightCompanyNumber,
      right: leftCompanyNumber,
    });
  }

  return (
    <div className="flex h-full w-full flex-col space-y-6 pb-6">
      <section className="cb-card rounded-3xl p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
                Compare Entities
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
                Side-by-side company comparison
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cb-text-muted)]">
                Select two companies to compare current snapshot metrics, filing-backed histories, and the latest
                reported positions on one financial metric.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSwap}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] px-4 py-2 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:bg-[var(--cb-neutral-1)]"
              >
                <ArrowsLeftRight className="h-4 w-4" />
                Swap sides
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:items-start">
            <CompanySelector
              title="Left company"
              selectedCompanyNumber={leftCompanyNumber}
              selectedName={leftLabel}
              excludedCompanyNumber={rightCompanyNumber}
              quickPicks={quickPicks}
              onSelect={(result) => handleSelect("left", result)}
              onClear={() => handleClear("left")}
            />

            <div className="hidden xl:flex xl:h-full xl:items-center xl:justify-center">
              <div className="rounded-full border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] p-3 text-[var(--astronaut-700)]">
                <ArrowsLeftRight className="h-5 w-5" />
              </div>
            </div>

            <CompanySelector
              title="Right company"
              selectedCompanyNumber={rightCompanyNumber}
              selectedName={rightLabel}
              excludedCompanyNumber={leftCompanyNumber}
              quickPicks={quickPicks}
              onSelect={(result) => handleSelect("right", result)}
              onClear={() => handleClear("right")}
            />
          </div>

          {sameCompanySelected ? (
            <InlineMessage
              title="Choose two different companies"
              description="The compare view needs one company on each side. Pick a different company on the left or right to continue."
            />
          ) : null}

          {!leftCompanyNumber || !rightCompanyNumber ? (
            <InlineMessage
              title="Select two companies to begin"
              description="Once both sides are selected, the compare page will load live snapshot metrics and filing-backed history."
            />
          ) : null}

          {compareError && !sameCompanySelected ? (
            <InlineMessage title="Company comparison unavailable" description={compareError} />
          ) : null}
        </div>
      </section>

      {compareLoading ? (
        <EmptySection
          title="Loading company comparison..."
          description="Reading both company snapshots and the selected metric history."
        />
      ) : comparePayload ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <CompareSummaryCard
              tone="blue"
              sideLabel="Left entity"
              company={comparePayload.left}
              metric={selectedMetric}
              metricPayload={leftMetricPayload}
            />
            <CompareSummaryCard
              tone="slate"
              sideLabel="Right entity"
              company={comparePayload.right}
              metric={selectedMetric}
              metricPayload={rightMetricPayload}
            />
          </div>

          <section className="cb-card rounded-3xl p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">
                    Historical metric comparison
                  </h3>
                  <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                    Compare both entities on one metric across normalized history and filing-backed periods.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {METRIC_OPTIONS.map((metric) => (
                    <button
                      key={metric.key}
                      type="button"
                      onClick={() => updateParams({ metric: metric.key })}
                      className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                        selectedMetric.key === metric.key
                          ? "border-[var(--astronaut-200)] bg-[var(--astronaut-50)] text-[var(--astronaut-700)]"
                          : "border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] text-[var(--cb-text-muted)] hover:bg-[var(--cb-neutral-1)]"
                      }`}
                    >
                      {metric.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)]/75 px-4 py-4">
                <div className="text-sm font-semibold text-[var(--cb-text-strong)]">{selectedMetric.label}</div>
                <div className="mt-1 text-sm text-[var(--cb-text-muted)]">{selectedMetric.description}</div>
                {metricError ? (
                  <div className="mt-3 text-sm text-[var(--cb-text-muted)]">{metricError}</div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
                <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--cb-text-strong)]">Overlay chart</div>
                      <div className="mt-1 text-sm text-[var(--cb-text-muted)]">
                        Normalized metric history for both companies on the same time axis.
                      </div>
                    </div>
                    <div className="rounded-full bg-[var(--astronaut-50)] px-3 py-1 text-xs font-semibold text-[var(--astronaut-700)]">
                      {formatInteger(mergedChartData.length)} periods
                    </div>
                  </div>

                  {metricLoading ? (
                    <EmptyCompact label="Loading metric histories..." />
                  ) : mergedChartData.length ? (
                    <ChartContainer height={300}>
                      <LineChart data={mergedChartData}>
                        <CartesianGrid vertical={false} stroke="var(--cb-stroke-soft)" />
                        <XAxis
                          dataKey="periodDate"
                          tickFormatter={formatChartTick}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={24}
                          stroke="var(--cb-text-subtle)"
                        />
                        <YAxis
                          tickFormatter={(value) => formatAxisValue(value, selectedMetric.formatter)}
                          tickLine={false}
                          axisLine={false}
                          width={88}
                          stroke="var(--cb-text-subtle)"
                        />
                        <Tooltip
                          cursor={{ stroke: "var(--cb-stroke-soft)", strokeWidth: 2 }}
                          content={
                            <CompareHistoryTooltip
                              metricFormatter={selectedMetric.formatter}
                              leftLabel={leftLabel ?? leftCompanyNumber ?? "Left"}
                              rightLabel={rightLabel ?? rightCompanyNumber ?? "Right"}
                            />
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="leftValue"
                          name={leftLabel ?? leftCompanyNumber ?? "Left"}
                          stroke="var(--astronaut-700)"
                          strokeWidth={3}
                          dot={false}
                          connectNulls={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="rightValue"
                          name={rightLabel ?? rightCompanyNumber ?? "Right"}
                          stroke="var(--cb-text-subtle)"
                          strokeWidth={2.5}
                          dot={false}
                          strokeDasharray="6 6"
                          connectNulls={false}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <EmptyCompact label="No shared metric history was returned for the selected metric." />
                  )}
                </div>

                <div className="space-y-4">
                  <InsightCard
                    title="Latest gap"
                    value={formatMetricDelta(latestDelta, selectedMetric.formatter)}
                    note={
                      latestLeftValue !== null || latestRightValue !== null
                        ? `${leftLabel ?? leftCompanyNumber ?? "Left"} vs ${rightLabel ?? rightCompanyNumber ?? "Right"}`
                        : "Latest metric values not yet available"
                    }
                    tone="blue"
                  />
                  <InsightCard
                    title="History coverage"
                    value={historyCoverageLabel}
                    note="Filing-backed periods available for this metric"
                    tone="slate"
                  />
                  <InsightCard
                    title="Latest reported period"
                    value={periodAlignmentLabel}
                    note="Shows whether both entities are aligned on recency"
                    tone="slate"
                  />
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section className="cb-card rounded-3xl p-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">
                  Snapshot comparison
                </h3>
                <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                  Latest comparable values from the company snapshot API for both selected entities.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-[var(--cb-stroke-soft)]">
                <div className="grid grid-cols-[minmax(120px,1fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_minmax(120px,0.8fr)] gap-4 bg-[var(--cb-neutral-1)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
                  <div>Metric</div>
                  <div>{leftLabel ?? leftCompanyNumber}</div>
                  <div>{rightLabel ?? rightCompanyNumber}</div>
                  <div>Gap</div>
                </div>
                {SNAPSHOT_ROWS.map((row) => {
                  const leftValue = comparePayload.left[row.key];
                  const rightValue = comparePayload.right[row.key];
                  return (
                    <div
                      key={String(row.key)}
                      className="grid grid-cols-[minmax(120px,1fr)_minmax(130px,0.9fr)_minmax(130px,0.9fr)_minmax(120px,0.8fr)] gap-4 border-t border-[var(--cb-stroke-soft)] px-4 py-4 text-sm"
                    >
                      <div className="font-medium text-[var(--cb-text-strong)]">{row.label}</div>
                      <div className="font-semibold text-[var(--cb-text-strong)]">
                        {formatMetricValue(leftValue, row.formatter)}
                      </div>
                      <div className="font-semibold text-[var(--cb-text-strong)]">
                        {formatMetricValue(rightValue, row.formatter)}
                      </div>
                      <div className="text-[var(--cb-text-muted)]">
                        {formatMetricDelta(computeLatestDelta(leftValue, rightValue), row.formatter)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="cb-card rounded-3xl p-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">
                  Filing-backed metric periods
                </h3>
                <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                  Latest filing-backed periods for {selectedMetric.label}, aligned by reported period where possible.
                </p>
              </div>

              {metricLoading ? (
                <EmptyCompact label="Loading filing-backed metric periods..." />
              ) : filingComparisonRows.length ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--cb-stroke-soft)]">
                  <div className="grid grid-cols-[minmax(110px,0.8fr)_minmax(110px,0.85fr)_minmax(110px,0.85fr)_minmax(110px,0.8fr)] gap-4 bg-[var(--cb-neutral-1)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
                    <div>Period</div>
                    <div>{leftLabel ?? leftCompanyNumber}</div>
                    <div>{rightLabel ?? rightCompanyNumber}</div>
                    <div>Gap</div>
                  </div>
                  {filingComparisonRows.slice(0, 8).map((row) => (
                    <div key={row.key} className="border-t border-[var(--cb-stroke-soft)] px-4 py-4">
                      <div className="grid grid-cols-[minmax(110px,0.8fr)_minmax(110px,0.85fr)_minmax(110px,0.85fr)_minmax(110px,0.8fr)] gap-4">
                        <div className="font-medium text-[var(--cb-text-strong)]">{row.periodLabel}</div>
                        <div className="font-semibold text-[var(--cb-text-strong)]">
                          {formatMetricValue(row.leftValue, selectedMetric.formatter)}
                        </div>
                        <div className="font-semibold text-[var(--cb-text-strong)]">
                          {formatMetricValue(row.rightValue, selectedMetric.formatter)}
                        </div>
                        <div className="text-[var(--cb-text-muted)]">
                          {formatMetricDelta(row.delta, selectedMetric.formatter)}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--cb-text-subtle)] md:grid-cols-2">
                        <div className="min-w-0">
                          {row.leftSourcePath
                            ? `${formatInteger(row.leftSourceCount)} source${row.leftSourceCount === 1 ? "" : "s"} • ${truncatePath(row.leftSourcePath)}`
                            : "No filing-backed value"}
                        </div>
                        <div className="min-w-0">
                          {row.rightSourcePath
                            ? `${formatInteger(row.rightSourceCount)} source${row.rightSourceCount === 1 ? "" : "s"} • ${truncatePath(row.rightSourcePath)}`
                            : "No filing-backed value"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyCompact label="No filing-backed comparison rows were returned for the selected metric." />
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function CompanySelector({
  title,
  selectedCompanyNumber,
  selectedName,
  excludedCompanyNumber,
  quickPicks,
  onSelect,
  onClear,
}: {
  title: string;
  selectedCompanyNumber: string | null;
  selectedName: string | null;
  excludedCompanyNumber: string | null;
  quickPicks: Array<{ companyNumber: string; name: string }>;
  onSelect: (result: CompanySearchResult) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await searchCompanies(trimmed, 6);
        if (!active) {
          return;
        }
        setResults(payload.filter((item) => item.company_number !== excludedCompanyNumber));
      } catch (searchError) {
        if (!active) {
          return;
        }
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Search failed");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [excludedCompanyNumber, query]);

  const availableQuickPicks = quickPicks.filter(
    (tab) =>
      tab.companyNumber !== excludedCompanyNumber &&
      tab.companyNumber !== selectedCompanyNumber,
  );

  return (
    <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">{title}</p>
          <p className="mt-2 text-base font-semibold text-[var(--cb-text-strong)]">
            {selectedName ?? "No company selected"}
          </p>
          <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
            {selectedCompanyNumber ? `Co. ${selectedCompanyNumber}` : "Search by company name or number"}
          </p>
        </div>

        {selectedCompanyNumber ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-[var(--cb-stroke-soft)] p-2 text-[var(--cb-text-subtle)] transition-colors hover:bg-[var(--cb-neutral-1)] hover:text-[var(--cb-text-strong)]"
            aria-label={`Clear ${title.toLowerCase()}`}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 rounded-full border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-3">
        <label className="flex items-center gap-3">
          <MagnifyingGlass className="h-4 w-4 text-[var(--cb-text-subtle)]" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search companies..."
            className="w-full border-none bg-transparent text-sm font-medium text-[var(--cb-text-strong)] outline-none placeholder:text-[var(--cb-text-subtle)]"
          />
        </label>
      </div>

      {query.trim().length >= 2 ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)]">
          {loading ? <SearchStateRow label="Searching companies..." /> : null}
          {!loading && error ? <SearchStateRow label={error} muted /> : null}
          {!loading && !error && results.length === 0 ? (
            <SearchStateRow label="No matching companies found" muted />
          ) : null}
          {!loading &&
            !error &&
            results.map((result) => (
              <button
                key={result.company_number}
                type="button"
                onClick={() => {
                  onSelect(result);
                  setQuery("");
                  setResults([]);
                  setError(null);
                }}
                className="flex w-full items-center justify-between gap-4 border-t border-[var(--cb-stroke-soft)] px-4 py-3 text-left first:border-t-0 transition-colors hover:bg-[var(--cb-neutral-1)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--cb-text-strong)]">{result.name}</p>
                  <p className="mt-1 text-xs text-[var(--cb-text-muted)]">
                    Co. {result.company_number}
                    {result.status ? ` • ${result.status}` : ""}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[var(--astronaut-700)]">Select</span>
              </button>
            ))}
        </div>
      ) : null}

      {availableQuickPicks.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
            Quick picks
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableQuickPicks.slice(0, 5).map((tab) => (
              <button
                key={tab.companyNumber}
                type="button"
                onClick={() =>
                  onSelect({
                    company_number: tab.companyNumber,
                    name: tab.name,
                    status: null,
                  })
                }
                className="rounded-full border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] px-3 py-2 text-sm font-medium text-[var(--cb-text-muted)] transition-colors hover:bg-[var(--cb-neutral-1)]"
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CompareSummaryCard({
  sideLabel,
  company,
  metric,
  metricPayload,
  tone,
}: {
  sideLabel: string;
  company: CompanyCompareSide;
  metric: CompareMetricOption;
  metricPayload: CompanyMetricDetailResponse | null;
  tone: "blue" | "slate";
}) {
  const surfaceStyle =
    tone === "blue"
      ? {
          background:
            "color-mix(in oklch, var(--cb-neutral-0) 82%, var(--astronaut-50) 18%)",
        }
      : undefined;

  const accentTone =
    tone === "blue"
      ? "text-[var(--astronaut-700)] border-[var(--astronaut-200)]"
      : "text-[var(--cb-text-subtle)] border-[var(--cb-stroke-soft)]";

  return (
    <section className={`cb-card rounded-3xl border p-6 ${accentTone}`} style={surfaceStyle}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
            {sideLabel}
          </p>
          <div className="mt-3 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--cb-neutral-1)] text-base font-semibold text-[var(--astronaut-700)]">
              {initialsFromName(company.name)}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
                {company.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                Co. {company.company_number}
                {company.status ? ` • ${company.status}` : ""}
              </p>
              <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                {company.region || "Region unavailable"}
              </p>
            </div>
          </div>
        </div>

        <Link
          href={`/company/${encodeURIComponent(company.company_number)}`}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] px-3 py-2 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:bg-[var(--cb-neutral-1)]"
        >
          <ArrowSquareOut className="h-4 w-4" />
          Open
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <MetricStat
          label={metric.label}
          value={formatMetricValue(metricPayload?.latest_value ?? null, metric.formatter)}
          hint={
            metricPayload?.latest_period_date
              ? `As of ${formatDate(metricPayload.latest_period_date)}`
              : "No latest value"
          }
        />
        <MetricStat
          label="Net Assets"
          value={formatCompactCurrency(company.net_assets)}
          hint="Snapshot value"
        />
        <MetricStat
          label="Current Ratio"
          value={formatRatio(company.current_ratio)}
          hint="Snapshot liquidity"
        />
        <MetricStat
          label="Employees"
          value={formatInteger(company.employees)}
          hint={`${formatInteger(company.psc_count)} PSC${company.psc_count === 1 ? "" : "s"}`}
        />
      </div>
    </section>
  );
}

function MetricStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)]/75 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--cb-text-muted)]">{hint}</p>
    </div>
  );
}

function InsightCard({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone: "blue" | "slate";
}) {
  const toneClasses =
    tone === "blue"
      ? "bg-[var(--astronaut-50)] text-[var(--astronaut-700)]"
      : "bg-[var(--cb-neutral-1)] text-[var(--cb-text-strong)]";

  return (
    <section className={`rounded-2xl border border-[var(--cb-stroke-soft)] p-5 ${toneClasses}`}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em]">
        <TrendUp className="h-4 w-4" />
        {title}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      <p className="mt-2 text-sm text-[var(--cb-text-muted)]">{note}</p>
    </section>
  );
}

function InlineMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-4">
      <div className="text-sm font-semibold text-[var(--cb-text-strong)]">{title}</div>
      <div className="mt-1 text-sm text-[var(--cb-text-muted)]">{description}</div>
    </div>
  );
}

function EmptySection({ title, description }: { title: string; description: string }) {
  return (
    <section className="cb-card rounded-3xl px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--cb-neutral-1)] text-[var(--astronaut-700)]">
        <ChartLineUp className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--cb-text-muted)]">{description}</p>
    </section>
  );
}

function EmptyCompact({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-6 text-center text-sm text-[var(--cb-text-muted)]">
      {label}
    </div>
  );
}

function SearchStateRow({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div
      className={`px-4 py-3 text-sm ${
        muted ? "text-[var(--cb-text-muted)]" : "text-[var(--cb-text-strong)]"
      }`}
    >
      {label}
    </div>
  );
}

function CompareHistoryTooltip({
  active,
  payload,
  label,
  metricFormatter,
  leftLabel,
  rightLabel,
}: {
  active?: boolean;
  payload?: Array<TooltipPayloadEntry<number, string>>;
  label?: string | number;
  metricFormatter: CompareMetricFormatter;
  leftLabel: string;
  rightLabel: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const leftEntry = payload.find((entry) => entry.dataKey === "leftValue") as
    | TooltipPayloadEntry<number, string>
    | undefined;
  const rightEntry = payload.find((entry) => entry.dataKey === "rightValue") as
    | TooltipPayloadEntry<number, string>
    | undefined;

  return (
    <div className="rounded-2xl border border-white/10 bg-[var(--cb-text-strong)] px-4 py-3 text-xs text-white shadow-xl">
      <p className="font-semibold text-white/70">
        {formatDate(typeof label === "string" ? label : String(label ?? ""))}
      </p>
      <div className="mt-2 space-y-2">
        <TooltipRow
          color="var(--astronaut-700)"
          label={leftLabel}
          value={formatMetricValue(leftEntry?.value ?? null, metricFormatter)}
        />
        <TooltipRow
          color="var(--cb-text-subtle)"
          label={rightLabel}
          value={formatMetricValue(rightEntry?.value ?? null, metricFormatter)}
        />
      </div>
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium">
        {label}: {value}
      </span>
    </div>
  );
}

function normalizeCompanyNumber(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}

function normalizeMetricSeries(payload: CompanyMetricDetailResponse | null): Array<{ periodDate: string; value: number }> {
  if (!payload) {
    return [];
  }

  const fromSeries = payload.series
    .map((point) => ({
      periodDate: point.period_date,
      value: coerceNumber(point.value),
    }))
    .filter((point): point is { periodDate: string; value: number } => Boolean(point.periodDate) && point.value !== null);

  if (fromSeries.length) {
    return fromSeries;
  }

  return payload.filings
    .map((item) => ({
      periodDate: item.period_date ?? item.filing.current_period_date ?? "",
      value: coerceNumber(item.value),
    }))
    .filter((point): point is { periodDate: string; value: number } => Boolean(point.periodDate) && point.value !== null);
}

function mergeMetricSeries(
  leftPayload: CompanyMetricDetailResponse | null,
  rightPayload: CompanyMetricDetailResponse | null,
): CompareChartPoint[] {
  const merged = new Map<string, CompareChartPoint>();

  for (const point of normalizeMetricSeries(leftPayload)) {
    const existing = merged.get(point.periodDate) ?? {
      periodDate: point.periodDate,
      leftValue: null,
      rightValue: null,
    };
    existing.leftValue = point.value;
    merged.set(point.periodDate, existing);
  }

  for (const point of normalizeMetricSeries(rightPayload)) {
    const existing = merged.get(point.periodDate) ?? {
      periodDate: point.periodDate,
      leftValue: null,
      rightValue: null,
    };
    existing.rightValue = point.value;
    merged.set(point.periodDate, existing);
  }

  return Array.from(merged.values()).sort((left, right) => left.periodDate.localeCompare(right.periodDate));
}

function buildFilingComparisonRows(
  leftPayload: CompanyMetricDetailResponse | null,
  rightPayload: CompanyMetricDetailResponse | null,
): FilingComparisonRow[] {
  const rows = new Map<string, FilingComparisonRow>();

  leftPayload?.filings.forEach((item, index) => {
    const key = item.period_date ?? item.filing.current_period_date ?? `left:${item.filing.document_id}:${index}`;
    const existing = rows.get(key) ?? {
      key,
      periodDate: item.period_date ?? item.filing.current_period_date,
      periodLabel: formatDate(item.period_date ?? item.filing.current_period_date),
      leftValue: null,
      rightValue: null,
      leftSourceCount: null,
      rightSourceCount: null,
      leftSourcePath: null,
      rightSourcePath: null,
      delta: null,
    };
    existing.leftValue = item.value;
    existing.leftSourceCount = item.source_count;
    existing.leftSourcePath = item.filing.source_path;
    rows.set(key, existing);
  });

  rightPayload?.filings.forEach((item, index) => {
    const key = item.period_date ?? item.filing.current_period_date ?? `right:${item.filing.document_id}:${index}`;
    const existing = rows.get(key) ?? {
      key,
      periodDate: item.period_date ?? item.filing.current_period_date,
      periodLabel: formatDate(item.period_date ?? item.filing.current_period_date),
      leftValue: null,
      rightValue: null,
      leftSourceCount: null,
      rightSourceCount: null,
      leftSourcePath: null,
      rightSourcePath: null,
      delta: null,
    };
    existing.rightValue = item.value;
    existing.rightSourceCount = item.source_count;
    existing.rightSourcePath = item.filing.source_path;
    rows.set(key, existing);
  });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      delta: computeLatestDelta(row.leftValue, row.rightValue),
    }))
    .sort((left, right) => {
      const leftKey = left.periodDate ?? "";
      const rightKey = right.periodDate ?? "";
      if (leftKey !== rightKey) {
        return rightKey.localeCompare(leftKey);
      }
      return left.key.localeCompare(right.key);
    });
}

function coerceNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computeLatestDelta(
  leftValue: string | number | null | undefined,
  rightValue: string | number | null | undefined,
): number | null {
  const left = coerceNumber(leftValue);
  const right = coerceNumber(rightValue);
  if (left === null || right === null) {
    return null;
  }
  return left - right;
}

function formatMetricValue(
  value: string | number | null | undefined,
  formatter: CompareMetricFormatter,
): string {
  if (formatter === "currency") {
    return formatCompactCurrency(value);
  }
  if (formatter === "ratio") {
    return formatRatio(coerceNumber(value));
  }
  return formatInteger(coerceNumber(value));
}

function formatMetricDelta(
  value: number | null,
  formatter: CompareMetricFormatter,
): string {
  if (value === null) {
    return "—";
  }
  if (formatter === "currency") {
    const absolute = formatCompactCurrency(Math.abs(value));
    return `${value > 0 ? "+" : value < 0 ? "-" : ""}${absolute.replace(/^[-+]/, "")}`;
  }
  if (formatter === "ratio") {
    const absolute = formatRatio(Math.abs(value));
    return `${value > 0 ? "+" : value < 0 ? "-" : ""}${absolute.replace(/^[-+]/, "")}`;
  }
  const absolute = formatInteger(Math.abs(value));
  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${absolute.replace(/^[-+]/, "")}`;
}

function formatAxisValue(value: number, formatter: CompareMetricFormatter): string {
  if (formatter === "currency") {
    return formatCompactCurrency(value);
  }
  if (formatter === "ratio") {
    return formatRatio(value);
  }
  return formatInteger(value);
}

function formatChartTick(value: string): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return String(parsed.getUTCFullYear());
}

function truncatePath(value: string): string {
  if (value.length <= 56) {
    return value;
  }
  return `${value.slice(0, 26)}…${value.slice(-24)}`;
}
