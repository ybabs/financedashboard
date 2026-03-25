"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";

import type { CompanyFilingDisclosureItem } from "@/lib/api";
import {
  formatCompactCurrency,
  formatDate,
  formatInteger,
  formatRatio,
} from "@/lib/format";
import {
  formatNormalizedTagLabel,
  getDisclosureFocusArea,
  getDisclosureFocusDescription,
  getDisclosureFocusLabel,
  type MetricFormatter,
} from "@/lib/financials";

export type NoteMetricLink = {
  metric_key: string;
  label: string;
  formatter: MetricFormatter;
  value: string | number | null;
  period_date: string | null;
  source_count: number | null;
};

export function NoteDetailDrawer({
  item,
  filingSourcePath,
  linkedMetrics,
  open,
  onClose,
}: {
  item: CompanyFilingDisclosureItem | null;
  filingSourcePath: string | null;
  linkedMetrics: NoteMetricLink[];
  open: boolean;
  onClose: () => void;
}) {
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

  if (!open || !item) {
    return null;
  }

  const focusArea = getDisclosureFocusArea(item);
  const displayValue = item.is_narrative
    ? item.value_text ?? "No narrative note text was captured for this disclosure."
    : item.numeric_value !== null
      ? formatCompactCurrency(item.numeric_value)
      : item.value_text ?? "—";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[rgba(23,28,31,0.2)] backdrop-blur-[10px]">
      <button type="button" className="flex-1 cursor-default" aria-label="Close note details" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[560px] flex-col bg-[var(--cb-page-bg)] shadow-[-12px_0_32px_rgba(23,28,31,0.08)]">
        <div className="sticky top-0 z-10 border-b border-[rgba(196,197,213,0.15)] bg-[rgba(255,255,255,0.8)] px-6 py-5 backdrop-blur-[16px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cb-text-subtle)]">
                Note Detail
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
                {item.label}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {focusArea ? <Tag label={getDisclosureFocusLabel(focusArea)} /> : null}
                <Tag label={item.section} subtle />
                <Tag label={item.is_narrative ? "Narrative disclosure" : "Tagged note balance"} subtle />
                {item.period_date ? <Tag label={`As of ${formatDate(item.period_date)}`} subtle /> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[var(--cb-text-subtle)] transition-colors hover:bg-[var(--cb-neutral-2)] hover:text-[var(--cb-text-strong)]"
              aria-label="Close note detail drawer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <DrawerSection title="Reported Note">
            {item.is_narrative ? (
              <p className="text-sm leading-7 text-[var(--cb-text-strong)]">{displayValue}</p>
            ) : (
              <div className="space-y-3">
                <div className="tabular-nums text-4xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
                  {displayValue}
                </div>
                {item.value_text && item.value_text !== String(item.numeric_value ?? "") ? (
                  <p className="text-sm leading-6 text-[var(--cb-text-muted)]">{item.value_text}</p>
                ) : null}
              </div>
            )}
          </DrawerSection>

          {focusArea ? (
            <DrawerSection title="Focus Area">
              <p className="text-sm leading-6 text-[var(--cb-text-muted)]">
                {getDisclosureFocusDescription(focusArea)}
              </p>
            </DrawerSection>
          ) : null}

          <DrawerSection title="Metric Linkage">
            {linkedMetrics.length ? (
              <div className="space-y-3">
                {linkedMetrics.map((metric) => (
                  <div
                    key={metric.metric_key}
                    className="rounded-xl bg-[var(--cb-neutral-1)] px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[var(--cb-text-strong)]">
                          {metric.label}
                        </div>
                        <div className="mt-1 text-xs text-[var(--cb-text-muted)]">
                          {metric.period_date
                            ? `Selected filing snapshot value as of ${formatDate(metric.period_date)}`
                            : "Mapped metric with no selected-filing snapshot value"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="tabular-nums text-sm font-semibold text-[var(--cb-text-strong)]">
                          {formatMetricValue(metric.value, metric.formatter)}
                        </div>
                        {metric.source_count !== null ? (
                          <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
                            {metric.source_count} source{metric.source_count === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState label="This disclosure is not currently mapped to a normalized financial metric." compact />
            )}
          </DrawerSection>

          <DrawerSection title="Tag Context">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ContextItem label="Raw tag" value={item.raw_tag} wrapLongValue />
              <ContextItem label="Normalized tag" value={formatNormalizedTagLabel(item.normalized_tag)} wrapLongValue />
              <ContextItem label="Disclosure section" value={item.section} />
              <ContextItem label="Reported period" value={item.period_date ? formatDate(item.period_date) : "Unavailable"} />
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
                  Filing source
                </div>
                <div className="mt-1 break-all text-sm text-[var(--cb-text-muted)]">
                  {filingSourcePath ?? "Unavailable"}
                </div>
              </div>
              {item.dimensions.length ? (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
                    Dimensions
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.dimensions.map((dimension) => (
                      <Tag key={`${item.fact_id}:${dimension}`} label={dimension} subtle />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </DrawerSection>
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
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--cb-text-subtle)]">
        {title}
      </h3>
      <div className="rounded-xl bg-[var(--cb-neutral-0)] px-4 py-4 shadow-[0_12px_32px_rgba(23,28,31,0.04)] ring-1 ring-[rgba(196,197,213,0.15)]">
        {children}
      </div>
    </section>
  );
}

function ContextItem({
  label,
  value,
  wrapLongValue = false,
}: {
  label: string;
  value: string;
  wrapLongValue?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[var(--cb-neutral-1)] px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
        {label}
      </div>
      <div
        className={`mt-2 text-sm text-[var(--cb-text-strong)] ${
          wrapLongValue ? "break-all font-mono text-[13px] leading-6" : ""
        }`}
      >
        {value}
      </div>
    </div>
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
