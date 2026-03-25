"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChartLineUp, X } from "@phosphor-icons/react/dist/ssr";
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

import { CompanyMetricDetailResponse, getCompanyMetricDetail } from "@/lib/api";
import { formatCompactCurrency, formatDate, formatInteger, formatRatio } from "@/lib/format";
import { formatMetricLabel, formatNormalizedTagLabel, type MetricFormatter } from "@/lib/financials";

type MetricDetailState = {
  companyNumber: string;
  metricKey: string;
  payload: CompanyMetricDetailResponse | null;
  error: string | null;
  loaded: boolean;
};

export function MetricDetailDrawer({
  companyNumber,
  metricKey,
  metricLabel,
  formatter,
  currentValue,
  currentPeriodDate,
  open,
  onClose,
  onOpenFilingHistory,
  onOpenHistoricalView,
}: {
  companyNumber: string;
  metricKey: string | null;
  metricLabel: string;
  formatter: MetricFormatter;
  currentValue: string | number | null | undefined;
  currentPeriodDate: string | null | undefined;
  open: boolean;
  onClose: () => void;
  onOpenFilingHistory: () => void;
  onOpenHistoricalView: (metricKey: string) => void;
}) {
  const [detailState, setDetailState] = useState<MetricDetailState>({
    companyNumber,
    metricKey: "",
    payload: null,
    error: null,
    loaded: false,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    let active = true;

    if (!open || !metricKey) {
      return () => {
        active = false;
      };
    }

    getCompanyMetricDetail(companyNumber, metricKey)
      .then((payload) => {
        if (!active) {
          return;
        }
        setDetailState({
          companyNumber,
          metricKey,
          payload,
          error: null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setDetailState({
          companyNumber,
          metricKey,
          payload: null,
          error: error instanceof Error ? error.message : "Failed to load metric detail",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyNumber, metricKey, open]);

  const payload =
    detailState.companyNumber === companyNumber && detailState.metricKey === (metricKey ?? "")
      ? detailState.payload
      : null;
  const error =
    detailState.companyNumber === companyNumber && detailState.metricKey === (metricKey ?? "")
      ? detailState.error
      : null;
  const loading =
    Boolean(open && metricKey) &&
    (detailState.companyNumber !== companyNumber ||
      detailState.metricKey !== (metricKey ?? "") ||
      !detailState.loaded);

  const displayValue = currentValue ?? payload?.latest_value ?? null;
  const displayPeriodDate = currentPeriodDate ?? payload?.latest_period_date ?? null;
  const chartData = useMemo(
    () =>
      (payload?.series ?? []).map((item) => ({
        period: new Date(item.period_date).getFullYear().toString(),
        value: Number(item.value),
      })),
    [payload?.series],
  );
  const provenanceFormatter: MetricFormatter = formatter === "ratio" ? "currency" : formatter;

  if (!open || !metricKey) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(23,28,31,0.2)] backdrop-blur-[10px]">
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close metric details"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-[560px] flex-col bg-[var(--cb-page-bg)] shadow-[-12px_0_32px_rgba(23,28,31,0.08)]">
        <div className="sticky top-0 z-10 border-b border-[rgba(196,197,213,0.15)] bg-[rgba(255,255,255,0.8)] px-6 py-5 backdrop-blur-[16px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cb-text-subtle)]">
                Metric Detail
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
                {metricLabel}
              </h2>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="tabular-nums text-4xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
                  {formatMetricValue(displayValue, formatter)}
                </div>
                {displayPeriodDate ? (
                  <div className="pb-1 text-sm text-[var(--cb-text-muted)]">
                    As of {formatDate(displayPeriodDate)}
                  </div>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--cb-text-subtle)] transition-colors hover:bg-[var(--cb-neutral-2)] hover:text-[var(--cb-text-strong)]"
              aria-label="Close metric detail drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFilingHistory();
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[#00288e] to-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(23,28,31,0.08)] transition-opacity hover:opacity-90"
            >
              <ArrowUpRight className="h-4 w-4" />
              Open filing history
            </button>
            <button
              type="button"
              onClick={() => onOpenHistoricalView(metricKey)}
              className="inline-flex items-center gap-2 rounded-lg border border-[rgba(0,40,142,0.18)] bg-[var(--cb-neutral-0)] px-4 py-2.5 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:bg-[var(--cb-neutral-1)]"
            >
              <ChartLineUp className="h-4 w-4" />
              Open trends mode
            </button>
          </div>

          {loading ? <EmptyState label="Loading metric detail..." /> : null}
          {!loading && error ? <EmptyState label={error} /> : null}

          {!loading && !error ? (
            <>
              {payload?.derived_from.length ? (
                <DrawerSection title="Computation">
                  <p className="text-sm leading-6 text-[var(--cb-text-muted)]">
                    This is a derived metric built from{" "}
                    {payload.derived_from.map((item) => formatMetricLabel(item)).join(" and ")} across matched periods
                    and filing snapshots.
                  </p>
                </DrawerSection>
              ) : null}

              <DrawerSection title="Series History">
                {chartData.length > 0 ? (
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid stroke="rgba(23,28,31,0.06)" vertical={false} />
                        <XAxis
                          dataKey="period"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#7d889d", fontSize: 12 }}
                        />
                        <YAxis hide domain={["auto", "auto"]} />
                        <Tooltip content={<MetricTooltip formatter={formatter} />} cursor={{ stroke: "rgba(0,40,142,0.12)", strokeWidth: 2 }} />
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
                  </div>
                ) : (
                  <EmptyState label="No historical series available for this metric." compact />
                )}
              </DrawerSection>

              <DrawerSection title="Filing-backed Values">
                {payload?.filings.length ? (
                  <div className="space-y-3">
                    {payload.filings.map((item) => (
                      <div
                        key={`${item.filing.document_id}-${item.period_date ?? "na"}`}
                        className="rounded-xl bg-[var(--cb-neutral-1)] px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[var(--cb-text-strong)]">
                              {item.period_date ? formatDate(item.period_date) : `Document ${item.filing.document_id}`}
                            </div>
                            <div className="mt-1 truncate text-xs text-[var(--cb-text-muted)]">
                              {item.filing.source_path}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="tabular-nums text-sm font-semibold text-[var(--cb-text-strong)]">
                              {formatMetricValue(item.value, formatter)}
                            </div>
                            <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
                              {item.source_count} source{item.source_count === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState label="No filing-specific values were resolved for this metric." compact />
                )}
              </DrawerSection>

              {payload?.tags.length || payload?.derived_from.length ? (
                <DrawerSection title="Supporting Tags">
                  <div className="flex flex-wrap gap-2">
                    {payload.derived_from.map((item) => (
                      <Tag key={`derived:${item}`} label={`Derived from ${formatMetricLabel(item)}`} />
                    ))}
                    {payload.tags.map((item) => (
                      <Tag key={item} label={formatNormalizedTagLabel(item)} />
                    ))}
                  </div>
                </DrawerSection>
              ) : null}

              <DrawerSection title="Latest Filing Provenance">
                {payload?.latest_filing ? (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-[var(--cb-neutral-1)] px-4 py-4">
                      <div className="text-sm font-semibold text-[var(--cb-text-strong)]">
                        {payload.latest_period_date ? formatDate(payload.latest_period_date) : `Document ${payload.latest_filing.document_id}`}
                      </div>
                      <div className="mt-1 text-xs text-[var(--cb-text-muted)]">
                        {payload.latest_filing.source_path}
                      </div>
                    </div>

                    {payload.provenance_facts.length ? (
                      <div className="space-y-3">
                        {payload.provenance_facts.map((item, index) => (
                          <div
                            key={`${item.document_id}:${item.context_ref ?? "no-context"}:${item.raw_tag}:${item.normalized_tag}:${item.value}:${index}`}
                            className="rounded-xl bg-[var(--cb-neutral-1)] px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-[var(--cb-text-strong)]">
                                  {formatNormalizedTagLabel(item.normalized_tag)}
                                </div>
                                <div className="mt-1 text-xs text-[var(--cb-text-muted)]">{item.raw_tag}</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Tag label={item.has_dimensions ? "Dimensional fact" : "Headline fact"} subtle />
                                  {item.context_ref ? <Tag label={`Context ${item.context_ref}`} subtle /> : null}
                                </div>
                              </div>
                              <div className="tabular-nums text-right text-sm font-semibold text-[var(--cb-text-strong)]">
                                {formatMetricValue(item.value, provenanceFormatter)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState label="No raw supporting facts were captured for the latest filing." compact />
                    )}
                  </div>
                ) : (
                  <EmptyState label="No filing provenance is available for this metric yet." compact />
                )}
              </DrawerSection>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cb-text-subtle)]">{title}</h3>
      <div className="rounded-xl bg-[var(--cb-neutral-0)] px-4 py-4 shadow-[0_12px_32px_rgba(23,28,31,0.04)] ring-1 ring-[rgba(196,197,213,0.15)]">
        {children}
      </div>
    </section>
  );
}

function Tag({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={`inline-flex rounded-lg px-3 py-1 text-xs font-medium ${
        subtle
          ? "bg-[var(--cb-neutral-2)] text-[var(--cb-text-muted)]"
          : "bg-[#edf4ff] text-[#2f5f9f]"
      }`}
    >
      {label}
    </span>
  );
}

function EmptyState({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-xl bg-[var(--cb-neutral-1)] text-sm text-[var(--cb-text-muted)] ${
        compact ? "px-4 py-4" : "px-5 py-5"
      }`}
    >
      {label}
    </div>
  );
}

function MetricTooltip({
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
      <p className="mb-1 font-semibold text-[var(--cb-text-subtle)]">{label}</p>
      <p className="tabular-nums text-lg font-bold text-[var(--cb-text-strong)]">
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
