"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

import {
  CompanyFilingDisclosureItem,
  CompanyFilingDisclosureResponse,
  CompanyFilingCompareMetric,
  CompanyFilingCompareResponse,
  CompanyFilingItem,
  CompanyFilingMetricValue,
  CompanyFilingSnapshotResponse,
  compareCompanyFilings,
  getCompanyFilings,
  getCompanyFilingDisclosures,
  getCompanyFilingSnapshot,
} from "@/lib/api";
import { formatCompactCurrency, formatDate, formatInteger } from "@/lib/format";
import {
  formatMetricLabel,
  getDisclosureFocusArea,
  getDisclosureFocusDescription,
  getDisclosureFocusLabel,
  type DisclosureFocusArea,
} from "@/lib/financials";
import { useCompanyData } from "../company-context";
import { NoteDetailDrawer, type NoteMetricLink } from "../note-detail-drawer";

type FilingMetricFormatter = "currency" | "integer";

type FilingMetricConfig = {
  key: string;
  label: string;
  formatter: FilingMetricFormatter;
};

type FilingMetricGroup = {
  key: string;
  title: string;
  description: string;
  metrics: string[];
};

type DisclosureFocusGroup = {
  area: DisclosureFocusArea;
  label: string;
  description: string;
  items: CompanyFilingDisclosureItem[];
  linkedMetricLabels: string[];
};

type FilingHistoryState = {
  companyId: string;
  items: CompanyFilingItem[];
  error: string | null;
  loaded: boolean;
};

type FilingSnapshotState = {
  companyId: string;
  documentId: number | null;
  payload: CompanyFilingSnapshotResponse | null;
  error: string | null;
  loaded: boolean;
};

type FilingCompareState = {
  companyId: string;
  leftDocumentId: number | null;
  rightDocumentId: number | null;
  payload: CompanyFilingCompareResponse | null;
  error: string | null;
  loaded: boolean;
};

type FilingDisclosureState = {
  companyId: string;
  documentId: number | null;
  payload: CompanyFilingDisclosureResponse | null;
  error: string | null;
  loaded: boolean;
};

type FilingDisclosureUiState = {
  companyId: string;
  documentId: number | null;
  selectedFactId: number | null;
  disclosuresExpanded: boolean;
  noteBalancesExpanded: boolean;
};

const EMPTY_FILINGS: CompanyFilingItem[] = [];

const FILING_METRICS: FilingMetricConfig[] = [
  { key: "turnover", label: "Turnover", formatter: "currency" },
  { key: "net_assets", label: "Net Assets", formatter: "currency" },
  { key: "current_assets", label: "Current Assets", formatter: "currency" },
  { key: "creditors", label: "Current Liabilities", formatter: "currency" },
  { key: "cash", label: "Cash", formatter: "currency" },
  { key: "employees", label: "Employees", formatter: "integer" },
  { key: "operating_profit", label: "Operating Profit", formatter: "currency" },
  { key: "profit_before_tax", label: "Profit Before Tax", formatter: "currency" },
  { key: "net_profit", label: "Net Profit", formatter: "currency" },
  { key: "net_current_assets", label: "Net Current Assets", formatter: "currency" },
  { key: "fixed_assets", label: "Fixed Assets", formatter: "currency" },
  { key: "investments", label: "Investments", formatter: "currency" },
  { key: "debtors", label: "Debtors", formatter: "currency" },
  { key: "trade_debtors", label: "Trade Debtors", formatter: "currency" },
  { key: "trade_creditors", label: "Trade Creditors", formatter: "currency" },
  { key: "other_debtors", label: "Other Debtors", formatter: "currency" },
  { key: "other_creditors", label: "Other Creditors", formatter: "currency" },
  { key: "deferred_tax", label: "Deferred Tax", formatter: "currency" },
];

const FILING_GROUPS: FilingMetricGroup[] = [
  {
    key: "headline",
    title: "Headline Metrics",
    description: "Latest values resolved from the selected filing only",
    metrics: ["turnover", "net_assets", "current_assets", "creditors", "cash", "employees"],
  },
  {
    key: "profitability",
    title: "Profitability",
    description: "P&L facts when the filing contains them",
    metrics: ["operating_profit", "profit_before_tax", "net_profit"],
  },
  {
    key: "balance_sheet",
    title: "Balance Sheet Breakdown",
    description: "Additional statement and note-level balances",
    metrics: [
      "net_current_assets",
      "fixed_assets",
      "investments",
      "debtors",
      "trade_debtors",
      "trade_creditors",
      "other_debtors",
      "other_creditors",
      "deferred_tax",
    ],
  },
];

const METRIC_CONFIG_BY_KEY = new Map(FILING_METRICS.map((item) => [item.key, item] as const));

export default function CompanyFilingsPage() {
  const { companyId, detail } = useCompanyData();
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [comparisonDocumentId, setComparisonDocumentId] = useState<number | "none" | null>(null);
  const [disclosureUiState, setDisclosureUiState] = useState<FilingDisclosureUiState>({
    companyId,
    documentId: null,
    selectedFactId: null,
    disclosuresExpanded: false,
    noteBalancesExpanded: false,
  });
  const [historyState, setHistoryState] = useState<FilingHistoryState>({
    companyId,
    items: [],
    error: null,
    loaded: false,
  });
  const [snapshotState, setSnapshotState] = useState<FilingSnapshotState>({
    companyId,
    documentId: null,
    payload: null,
    error: null,
    loaded: false,
  });
  const [compareState, setCompareState] = useState<FilingCompareState>({
    companyId,
    leftDocumentId: null,
    rightDocumentId: null,
    payload: null,
    error: null,
    loaded: false,
  });
  const [disclosureState, setDisclosureState] = useState<FilingDisclosureState>({
    companyId,
    documentId: null,
    payload: null,
    error: null,
    loaded: false,
  });

  useEffect(() => {
    let active = true;

    getCompanyFilings(companyId)
      .then((payload) => {
        if (!active) {
          return;
        }
        setHistoryState({
          companyId,
          items: payload.items,
          error: null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setHistoryState({
          companyId,
          items: [],
          error: error instanceof Error ? error.message : "Failed to load filing history",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyId]);

  const isCurrentCompany = historyState.companyId === companyId;
  const filings = isCurrentCompany ? historyState.items : EMPTY_FILINGS;
  const historyError = isCurrentCompany ? historyState.error : null;
  const historyLoading = !isCurrentCompany || !historyState.loaded;

  const effectiveSelectedDocumentId = useMemo(
    () =>
      selectedDocumentId && filings.some((item) => item.document_id === selectedDocumentId)
        ? selectedDocumentId
        : filings[0]?.document_id ?? null,
    [filings, selectedDocumentId],
  );

  const selectedFiling = useMemo(
    () => filings.find((item) => item.document_id === effectiveSelectedDocumentId) ?? null,
    [effectiveSelectedDocumentId, filings],
  );

  const defaultComparisonDocumentId = useMemo(() => {
    if (!effectiveSelectedDocumentId) {
      return null;
    }
    const selectedIndex = filings.findIndex((item) => item.document_id === effectiveSelectedDocumentId);
    if (selectedIndex === -1) {
      return filings.find((item) => item.document_id !== effectiveSelectedDocumentId)?.document_id ?? null;
    }
    return (
      filings[selectedIndex + 1]?.document_id ??
      filings.find((item) => item.document_id !== effectiveSelectedDocumentId)?.document_id ??
      null
    );
  }, [effectiveSelectedDocumentId, filings]);

  const effectiveComparisonDocumentId = useMemo(() => {
    if (comparisonDocumentId === "none") {
      return null;
    }
    if (
      comparisonDocumentId &&
      comparisonDocumentId !== effectiveSelectedDocumentId &&
      filings.some((item) => item.document_id === comparisonDocumentId)
    ) {
      return comparisonDocumentId;
    }
    return defaultComparisonDocumentId;
  }, [comparisonDocumentId, defaultComparisonDocumentId, effectiveSelectedDocumentId, filings]);

  useEffect(() => {
    let active = true;

    if (!effectiveSelectedDocumentId) {
      return () => {
        active = false;
      };
    }

    getCompanyFilingSnapshot(companyId, effectiveSelectedDocumentId)
      .then((payload) => {
        if (!active) {
          return;
        }
        setSnapshotState({
          companyId,
          documentId: effectiveSelectedDocumentId,
          payload,
          error: null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setSnapshotState({
          companyId,
          documentId: effectiveSelectedDocumentId,
          payload: null,
          error: error instanceof Error ? error.message : "Failed to load filing snapshot",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyId, effectiveSelectedDocumentId]);

  useEffect(() => {
    let active = true;

    if (!effectiveSelectedDocumentId) {
      return () => {
        active = false;
      };
    }

    getCompanyFilingDisclosures(companyId, effectiveSelectedDocumentId)
      .then((payload) => {
        if (!active) {
          return;
        }
        setDisclosureState({
          companyId,
          documentId: effectiveSelectedDocumentId,
          payload,
          error: null,
          loaded: true,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setDisclosureState({
          companyId,
          documentId: effectiveSelectedDocumentId,
          payload: null,
          error: error instanceof Error ? error.message : "Failed to load filing disclosures",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyId, effectiveSelectedDocumentId]);

  useEffect(() => {
    let active = true;

    if (!effectiveSelectedDocumentId || !effectiveComparisonDocumentId) {
      return () => {
        active = false;
      };
    }

    compareCompanyFilings(companyId, effectiveSelectedDocumentId, effectiveComparisonDocumentId)
      .then((payload) => {
        if (!active) {
          return;
        }
        setCompareState({
          companyId,
          leftDocumentId: effectiveSelectedDocumentId,
          rightDocumentId: effectiveComparisonDocumentId,
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
          companyId,
          leftDocumentId: effectiveSelectedDocumentId,
          rightDocumentId: effectiveComparisonDocumentId,
          payload: null,
          error: error instanceof Error ? error.message : "Failed to compare filings",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyId, effectiveComparisonDocumentId, effectiveSelectedDocumentId]);

  const snapshotPayload =
    snapshotState.companyId === companyId && snapshotState.documentId === effectiveSelectedDocumentId
      ? snapshotState.payload
      : null;
  const snapshotError =
    snapshotState.companyId === companyId && snapshotState.documentId === effectiveSelectedDocumentId
      ? snapshotState.error
      : null;
  const snapshotLoading =
    Boolean(effectiveSelectedDocumentId) &&
    (snapshotState.companyId !== companyId ||
      snapshotState.documentId !== effectiveSelectedDocumentId ||
      !snapshotState.loaded);

  const comparePayload =
    compareState.companyId === companyId &&
    compareState.leftDocumentId === effectiveSelectedDocumentId &&
    compareState.rightDocumentId === effectiveComparisonDocumentId
      ? compareState.payload
      : null;
  const compareError =
    compareState.companyId === companyId &&
    compareState.leftDocumentId === effectiveSelectedDocumentId &&
    compareState.rightDocumentId === effectiveComparisonDocumentId
      ? compareState.error
      : null;
  const compareLoading =
    Boolean(effectiveSelectedDocumentId && effectiveComparisonDocumentId) &&
    (compareState.companyId !== companyId ||
      compareState.leftDocumentId !== effectiveSelectedDocumentId ||
      compareState.rightDocumentId !== effectiveComparisonDocumentId ||
      !compareState.loaded);

  const disclosuresPayload =
    disclosureState.companyId === companyId && disclosureState.documentId === effectiveSelectedDocumentId
      ? disclosureState.payload
      : null;
  const disclosuresError =
    disclosureState.companyId === companyId && disclosureState.documentId === effectiveSelectedDocumentId
      ? disclosureState.error
      : null;
  const disclosuresLoading =
    Boolean(effectiveSelectedDocumentId) &&
    (disclosureState.companyId !== companyId ||
      disclosureState.documentId !== effectiveSelectedDocumentId ||
      !disclosureState.loaded);

  const snapshotMetricMap = useMemo(() => {
    const metrics = new Map<string, CompanyFilingMetricValue>();
    for (const item of snapshotPayload?.metrics ?? []) {
      metrics.set(item.metric_key, item);
    }
    return metrics;
  }, [snapshotPayload]);

  const groupedSnapshotMetrics = useMemo(
    () =>
      FILING_GROUPS.map((group) => ({
        ...group,
        cards: group.metrics
          .map((metricKey) => {
            const config = METRIC_CONFIG_BY_KEY.get(metricKey);
            const metric = snapshotMetricMap.get(metricKey);
            return config && metric ? { ...config, metric } : null;
          })
          .filter((item): item is FilingMetricConfig & { metric: CompanyFilingMetricValue } => Boolean(item)),
      })).filter((group) => group.cards.length > 0),
    [snapshotMetricMap],
  );

  const orderedCompareMetrics = useMemo(() => {
    const compareMetrics = new Map<string, CompanyFilingCompareMetric>();
    for (const item of comparePayload?.metrics ?? []) {
      compareMetrics.set(item.metric_key, item);
    }

    const used = new Set<string>();
    const ordered: Array<FilingMetricConfig & { metric: CompanyFilingCompareMetric }> = [];

    for (const config of FILING_METRICS) {
      const metric = compareMetrics.get(config.key);
      if (!metric) {
        continue;
      }
      used.add(config.key);
      ordered.push({ ...config, metric });
    }

    for (const metric of comparePayload?.metrics ?? []) {
      if (used.has(metric.metric_key)) {
        continue;
      }
      ordered.push({
        key: metric.metric_key,
        label: formatMetricLabel(metric.metric_key),
        formatter: "currency",
        metric,
      });
    }

    return ordered.filter((item) => item.metric.left_value !== null || item.metric.right_value !== null);
  }, [comparePayload]);

  const groupedDisclosures = useMemo(() => {
    const grouped = new Map<string, CompanyFilingDisclosureItem[]>();
    for (const item of disclosuresPayload?.items ?? []) {
      const existing = grouped.get(item.section) ?? [];
      existing.push(item);
      grouped.set(item.section, existing);
    }
    return Array.from(grouped.entries())
      .map(([section, items]) => ({ section, items }))
      .sort((left, right) => {
        if (left.section === right.section) {
          return 0;
        }
        if (left.section === "Note Balances") {
          return 1;
        }
        if (right.section === "Note Balances") {
          return -1;
        }
        return left.section.localeCompare(right.section);
      });
  }, [disclosuresPayload]);

  const disclosureFocusGroups = useMemo<DisclosureFocusGroup[]>(() => {
    const grouped = new Map<DisclosureFocusArea, CompanyFilingDisclosureItem[]>();
    for (const item of disclosuresPayload?.items ?? []) {
      const area = getDisclosureFocusArea(item);
      if (!area) {
        continue;
      }
      const existing = grouped.get(area) ?? [];
      existing.push(item);
      grouped.set(area, existing);
    }

    return (
      ["director_remuneration", "dividends", "loans", "related_parties"] as DisclosureFocusArea[]
    )
      .map((area) => {
        const items = grouped.get(area) ?? [];
        if (!items.length) {
          return null;
        }
        const linkedMetricLabels = Array.from(
          new Set(items.flatMap((item) => item.linked_metric_keys.map((metricKey) => getMetricLabel(metricKey)))),
        ).slice(0, 3);
        return {
          area,
          label: getDisclosureFocusLabel(area),
          description: getDisclosureFocusDescription(area),
          items,
          linkedMetricLabels,
        };
      })
      .filter((item): item is DisclosureFocusGroup => Boolean(item));
  }, [disclosuresPayload]);

  const disclosureUiMatches =
    disclosureUiState.companyId === companyId &&
    disclosureUiState.documentId === effectiveSelectedDocumentId;
  const selectedDisclosureFactId = disclosureUiMatches ? disclosureUiState.selectedFactId : null;
  const disclosuresExpanded = disclosureUiMatches ? disclosureUiState.disclosuresExpanded : false;
  const noteBalancesExpanded = disclosureUiMatches ? disclosureUiState.noteBalancesExpanded : false;

  function updateDisclosureUi(
    updater: (
      current: Pick<FilingDisclosureUiState, "selectedFactId" | "disclosuresExpanded" | "noteBalancesExpanded">,
    ) => Pick<FilingDisclosureUiState, "selectedFactId" | "disclosuresExpanded" | "noteBalancesExpanded">,
  ) {
    setDisclosureUiState((current) => {
      const base =
        current.companyId === companyId && current.documentId === effectiveSelectedDocumentId
          ? {
              selectedFactId: current.selectedFactId,
              disclosuresExpanded: current.disclosuresExpanded,
              noteBalancesExpanded: current.noteBalancesExpanded,
            }
          : {
              selectedFactId: null,
              disclosuresExpanded: false,
              noteBalancesExpanded: false,
            };

      return {
        companyId,
        documentId: effectiveSelectedDocumentId,
        ...updater(base),
      };
    });
  }

  const selectedDisclosure = useMemo(
    () => disclosuresPayload?.items.find((item) => item.fact_id === selectedDisclosureFactId) ?? null,
    [disclosuresPayload, selectedDisclosureFactId],
  );

  const selectedDisclosureMetricLinks = useMemo<NoteMetricLink[]>(() => {
    if (!selectedDisclosure) {
      return [];
    }
    return selectedDisclosure.linked_metric_keys
      .map((metricKey) => {
        const metric = snapshotMetricMap.get(metricKey) ?? null;
        return {
          metric_key: metricKey,
          label: getMetricLabel(metricKey),
          formatter: getMetricFormatter(metricKey),
          value: metric?.value ?? null,
          period_date: metric?.period_date ?? null,
          source_count: metric?.source_count ?? null,
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [selectedDisclosure, snapshotMetricMap]);

  return (
    <div className="flex h-full w-full flex-col space-y-6 pb-6">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f8a98]">Filing History</h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Review the ingested iXBRL filings for this company, inspect one filing’s financial snapshot, and compare it
            against another period.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-3xl bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#1c1c1c]">Available filings</h3>
              <p className="mt-1 text-xs text-[#8c8c8c]">
                {detail?.name ?? companyId} has {filings.length} ingested filing{filings.length === 1 ? "" : "s"}.
              </p>
            </div>
            {historyLoading ? (
              <EmptyState
                title="Loading filing history..."
                description="Reading ingested iXBRL documents for this company."
              />
            ) : historyError ? (
              <EmptyState title="Filing history unavailable" description={historyError} />
            ) : filings.length === 0 ? (
              <EmptyState title="No filings loaded" description="No ingested iXBRL filings are available for this company yet." />
            ) : (
              <div className="space-y-3">
                {filings.map((item) => (
                  <FilingListCard
                    key={item.document_id}
                    item={item}
                    selected={item.document_id === effectiveSelectedDocumentId}
                    comparison={item.document_id === effectiveComparisonDocumentId}
                    onSelect={() => setSelectedDocumentId(item.document_id)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#1c1c1c]">Selected filing snapshot</div>
                  <div className="mt-1 text-sm text-[#6b7280]">
                    {selectedFiling?.current_period_date
                      ? `Latest facts in this filing are dated ${formatDate(selectedFiling.current_period_date)}.`
                      : "Select a filing to inspect its extracted financial snapshot."}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <SelectField
                    label="Primary filing"
                    value={effectiveSelectedDocumentId ? String(effectiveSelectedDocumentId) : ""}
                    onChange={(value) => setSelectedDocumentId(Number(value))}
                    options={filings.map((item) => ({
                      value: String(item.document_id),
                      label: formatFilingOptionLabel(item),
                    }))}
                    disabled={filings.length === 0}
                  />
                  <SelectField
                    label="Compare against"
                    value={effectiveComparisonDocumentId ? String(effectiveComparisonDocumentId) : ""}
                    onChange={(value) => setComparisonDocumentId(value ? Number(value) : "none")}
                    options={[
                      { value: "", label: "No comparison" },
                      ...filings
                        .filter((item) => item.document_id !== effectiveSelectedDocumentId)
                        .map((item) => ({
                          value: String(item.document_id),
                          label: formatFilingOptionLabel(item),
                        })),
                    ]}
                    disabled={filings.length < 2}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1c1c1c]">Filing-specific financial snapshot</h3>
                  <p className="mt-1 text-xs text-[#8c8c8c]">
                    This view is derived from the currently selected filing only, not the cross-filing series model.
                  </p>
                </div>
                {snapshotPayload?.filing ? (
                  <div className="text-xs text-[#8c8c8c]">
                    Source: <span className="font-medium text-[#4b5563]">{snapshotPayload.filing.source_path}</span>
                  </div>
                ) : null}
              </div>

              {snapshotLoading ? (
                <EmptyState
                  title="Loading filing snapshot..."
                  description="Resolving current-period facts from the selected filing."
                />
              ) : snapshotError ? (
                <EmptyState title="Filing snapshot unavailable" description={snapshotError} />
              ) : groupedSnapshotMetrics.length === 0 ? (
                <EmptyState
                  title="No financial metrics extracted"
                  description="This filing does not currently expose mapped numeric metrics for the latest period."
                />
              ) : (
                <div className="space-y-6">
                  {groupedSnapshotMetrics.map((group) => (
                    <div key={group.key} className="space-y-3">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">{group.title}</h4>
                        <p className="mt-1 text-sm text-[#6b7280]">{group.description}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {group.cards.map((item) => (
                          <SnapshotMetricCard
                            key={item.key}
                            label={item.label}
                            value={formatMetricValue(item.metric.value, item.formatter)}
                            hint={item.metric.period_date ? `As of ${formatDate(item.metric.period_date)}` : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-[#1c1c1c]">Filing-to-filing changes</h3>
                <p className="mt-1 text-xs text-[#8c8c8c]">
                  Compare the selected filing against another filing to see how reported balances moved period to period.
                </p>
              </div>

              {!effectiveComparisonDocumentId ? (
                <EmptyState
                  title="No comparison filing selected"
                  description="Choose another filing to compare this snapshot against."
                />
              ) : compareLoading ? (
                <EmptyState
                  title="Comparing filings..."
                  description="Calculating metric-by-metric changes between the selected filings."
                />
              ) : compareError ? (
                <EmptyState title="Filing comparison unavailable" description={compareError} />
              ) : !comparePayload || orderedCompareMetrics.length === 0 ? (
                <EmptyState
                  title="No overlapping metrics to compare"
                  description="The selected filings did not return a comparable metric set."
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#e7edf5] bg-[#fbfcfe] px-4 py-3 text-sm text-[#4b5563]">
                    Comparing <span className="font-semibold">{formatFilingOptionLabel(comparePayload.left_filing)}</span> against{" "}
                    <span className="font-semibold">{formatFilingOptionLabel(comparePayload.right_filing)}</span>.
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-[#e7edf5]">
                    <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-4 bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#7f8a98]">
                      <div>Metric</div>
                      <div>{comparePayload.left_filing.current_period_date ? formatDate(comparePayload.left_filing.current_period_date) : "Selected"}</div>
                      <div>{comparePayload.right_filing.current_period_date ? formatDate(comparePayload.right_filing.current_period_date) : "Compared"}</div>
                      <div>Change</div>
                    </div>
                    {orderedCompareMetrics.map((item) => (
                      <MetricChangeRow key={item.key} item={item} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#1c1c1c]">Notes and Tagged Disclosures</h3>
                  <p className="mt-1 text-xs text-[#8c8c8c]">
                    Narrative statements and note-level tagged balances captured from the selected filing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateDisclosureUi((current) => ({
                      ...current,
                      disclosuresExpanded: !current.disclosuresExpanded,
                    }))
                  }
                  className={`inline-flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all md:min-w-[240px] ${
                    disclosuresExpanded
                      ? "border border-[#c7d7ee] bg-[#eef4fb] shadow-[0_12px_24px_rgba(23,28,31,0.04)] hover:border-[#afc6e4] hover:bg-[#e7f0fb]"
                      : "border border-[#173bab] bg-gradient-to-br from-[#00288e] to-[#1e40af] text-white shadow-[0_12px_32px_rgba(23,28,31,0.12)] hover:opacity-95"
                  }`}
                >
                  <div>
                    <div
                      className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                        disclosuresExpanded ? "text-[#4f74a9]" : "text-[rgba(255,255,255,0.78)]"
                      }`}
                    >
                      {disclosuresExpanded ? "Hide" : "Show"} disclosures
                    </div>
                    <div
                      className={`mt-1 text-sm ${
                        disclosuresExpanded ? "text-[#163a69]" : "text-white"
                      }`}
                    >
                      {disclosuresPayload?.items.length ?? 0} tagged item{(disclosuresPayload?.items.length ?? 0) === 1 ? "" : "s"} across{" "}
                      {groupedDisclosures.length} section{groupedDisclosures.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <ArrowRight
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      disclosuresExpanded ? "text-[#4f74a9]" : "text-white"
                    } ${
                      disclosuresExpanded ? "rotate-90" : ""
                    }`}
                  />
                </button>
              </div>

              {disclosuresExpanded ? (
                <div className="mt-6">
                  {disclosuresLoading ? (
                    <EmptyState
                      title="Loading tagged disclosures..."
                      description="Reading narrative and dimensional facts from the selected filing."
                    />
                  ) : disclosuresError ? (
                    <EmptyState title="Tagged disclosures unavailable" description={disclosuresError} />
                  ) : groupedDisclosures.length === 0 ? (
                    <EmptyState
                      title="No tagged disclosures returned"
                      description="This filing did not return narrative statements or note-level tagged balances."
                    />
                  ) : (
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">
                            Targeted Note Areas
                          </h4>
                          <p className="mt-1 text-sm text-[#6b7280]">
                            Curated note topics surfaced from the filing, with direct links back to mapped headline metrics
                            where available.
                          </p>
                        </div>
                        {disclosureFocusGroups.length ? (
                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {disclosureFocusGroups.map((group) => (
                              <DisclosureFocusCard
                                key={group.area}
                                group={group}
                                onSelect={() =>
                                  updateDisclosureUi((current) => ({
                                    ...current,
                                    selectedFactId: group.items[0]?.fact_id ?? null,
                                  }))
                                }
                              />
                            ))}
                          </div>
                        ) : (
                          <EmptyState
                            title="No targeted note topics surfaced"
                            description="This filing did not return tagged disclosures for director remuneration, dividends, loans, or related parties."
                          />
                        )}
                      </div>

                      {groupedDisclosures.map((group) =>
                        group.section === "Note Balances" ? (
                          <div key={group.section} className="space-y-3">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                              <div>
                                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">
                                  {group.section}
                                </h4>
                                <p className="mt-1 text-sm text-[#6b7280]">
                                  {describeDisclosureSection(group.section)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  updateDisclosureUi((current) => ({
                                    ...current,
                                    noteBalancesExpanded: !current.noteBalancesExpanded,
                                  }))
                                }
                                className={`inline-flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-all md:min-w-[220px] ${
                                  noteBalancesExpanded
                                    ? "border border-[#c7d7ee] bg-[#eef4fb] shadow-[0_8px_20px_rgba(23,28,31,0.03)] hover:border-[#afc6e4] hover:bg-[#e7f0fb]"
                                    : "border border-[#d7e3f4] bg-[#f4f8fd] hover:border-[#c2d5ec] hover:bg-white"
                                }`}
                              >
                                <div>
                                  <div
                                    className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                                      noteBalancesExpanded ? "text-[#4f74a9]" : "text-[#7f8a98]"
                                    }`}
                                  >
                                    {noteBalancesExpanded ? "Hide" : "Show"} note balances
                                  </div>
                                  <div
                                    className={`mt-1 text-sm ${
                                      noteBalancesExpanded ? "text-[#163a69]" : "text-[#334155]"
                                    }`}
                                  >
                                    {group.items.length} tagged balance{group.items.length === 1 ? "" : "s"}
                                  </div>
                                </div>
                                <ArrowRight
                                  className={`h-4 w-4 shrink-0 transition-transform ${
                                    noteBalancesExpanded ? "text-[#4f74a9]" : "text-[#94a3b8]"
                                  } ${
                                    noteBalancesExpanded ? "rotate-90" : ""
                                  }`}
                                />
                              </button>
                            </div>
                            {noteBalancesExpanded ? (
                              <div className="space-y-3">
                                {group.items.map((item) => (
                                  <DisclosureCard
                                    key={item.fact_id}
                                    item={item}
                                    selected={item.fact_id === selectedDisclosureFactId}
                                    onSelect={() =>
                                      updateDisclosureUi((current) => ({
                                        ...current,
                                        selectedFactId: item.fact_id,
                                      }))
                                    }
                                  />
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div key={group.section} className="space-y-3">
                            <div>
                              <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">{group.section}</h4>
                              <p className="mt-1 text-sm text-[#6b7280]">
                                {describeDisclosureSection(group.section)}
                              </p>
                            </div>
                            <div className="space-y-3">
                              {group.items.map((item) => (
                                <DisclosureCard
                                  key={item.fact_id}
                                  item={item}
                                  selected={item.fact_id === selectedDisclosureFactId}
                                  onSelect={() =>
                                    updateDisclosureUi((current) => ({
                                      ...current,
                                      selectedFactId: item.fact_id,
                                    }))
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <NoteDetailDrawer
        item={selectedDisclosure}
        filingSourcePath={selectedFiling?.source_path ?? null}
        linkedMetrics={selectedDisclosureMetricLinks}
        open={Boolean(selectedDisclosure)}
        onClose={() =>
          updateDisclosureUi((current) => ({
            ...current,
            selectedFactId: null,
          }))
        }
      />
    </div>
  );
}

function FilingListCard({
  item,
  selected,
  comparison,
  onSelect,
}: {
  item: CompanyFilingItem;
  selected: boolean;
  comparison: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
        selected
          ? "border-[#cdddf4] bg-[#eef4fb]"
          : comparison
            ? "border-[#e4e9f0] bg-[#f8fafc]"
            : "border-[#eef2f7] bg-[#fbfcfe] hover:border-[#dbe6f4] hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[#1c1c1c]">
              {item.current_period_date ? formatDate(item.current_period_date) : `Document ${item.document_id}`}
            </div>
            {selected ? <Badge label="Selected" tone="blue" /> : null}
            {comparison ? <Badge label="Compare" tone="slate" /> : null}
          </div>
          <div className="mt-2 text-xs text-[#6b7280]">{item.source_path}</div>
          <div className="mt-2 text-xs text-[#8c8c8c]">
            Parsed {formatDate(item.parsed_at)} • {item.doc_type}
          </div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#94a3b8]" />
      </div>
    </button>
  );
}

function SnapshotMetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-[#eef2f7] bg-[#fbfcfe] p-5">
      <div>
        <div className="text-xs font-medium text-[#8c8c8c]">{label}</div>
        {hint ? <div className="mt-1 text-[11px] text-[#a0a0a0]">{hint}</div> : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-[#1c1c1c]">{value}</div>
    </div>
  );
}

function DisclosureFocusCard({
  group,
  onSelect,
}: {
  group: DisclosureFocusGroup;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-[#e7edf5] bg-[#fbfcfe] px-5 py-5 text-left transition-colors hover:border-[#d4dfed] hover:bg-white"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1c1c1c]">{group.label}</div>
          <div className="mt-2 text-sm leading-6 text-[#6b7280]">{group.description}</div>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#94a3b8]" />
      </div>
      <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="tabular-nums text-3xl font-semibold tracking-tight text-[#1c1c1c]">
            {group.items.length}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.12em] text-[#7f8a98]">
            Tagged disclosure{group.items.length === 1 ? "" : "s"}
          </div>
        </div>
        {group.linkedMetricLabels.length ? (
          <div className="flex flex-wrap gap-2 md:justify-end">
            {group.linkedMetricLabels.map((label) => (
              <span
                key={`${group.area}:${label}`}
                className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-[11px] font-medium text-[#2f5f9f]"
              >
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function DisclosureCard({
  item,
  selected,
  onSelect,
}: {
  item: CompanyFilingDisclosureItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const focusArea = getDisclosureFocusArea(item);
  const value = item.is_narrative
    ? item.value_text ?? "—"
    : item.numeric_value !== null
      ? formatCompactCurrency(item.numeric_value)
      : item.value_text ?? "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border px-5 py-4 text-left transition-colors ${
        selected
          ? "border-[#cdddf4] bg-[#eef4fb]"
          : "border-[#eef2f7] bg-[#fbfcfe] hover:border-[#dbe6f4] hover:bg-white"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-[#1c1c1c]">{item.label}</div>
            {focusArea ? <Badge label={getDisclosureFocusLabel(focusArea)} tone="blue" /> : null}
            {item.linked_metric_keys.length ? (
              <Badge
                label={`${item.linked_metric_keys.length} linked metric${item.linked_metric_keys.length === 1 ? "" : "s"}`}
                tone="slate"
              />
            ) : null}
          </div>
          <div className="mt-1 text-xs text-[#8c8c8c]">{item.raw_tag}</div>
          {item.linked_metric_keys.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.linked_metric_keys.slice(0, 3).map((metricKey) => (
                <span
                  key={`${item.fact_id}:metric:${metricKey}`}
                  className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-[11px] font-medium text-[#2f5f9f]"
                >
                  {getMetricLabel(metricKey)}
                </span>
              ))}
              {item.linked_metric_keys.length > 3 ? (
                <span className="rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[11px] font-medium text-[#64748b]">
                  +{item.linked_metric_keys.length - 3} more
                </span>
              ) : null}
            </div>
          ) : null}
          {item.dimensions.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.dimensions.map((dimension) => (
                <span
                  key={`${item.fact_id}-${dimension}`}
                  className="rounded-full bg-[#eef4fb] px-2.5 py-1 text-[11px] font-medium text-[#2f5f9f]"
                >
                  {dimension}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="min-w-[180px] text-left lg:text-right">
          <div className="flex items-center justify-between gap-3 lg:justify-end">
            {item.period_date ? <div className="text-[11px] text-[#8c8c8c]">As of {formatDate(item.period_date)}</div> : null}
            <ArrowRight className="h-4 w-4 shrink-0 text-[#94a3b8]" />
          </div>
          <div className={`mt-1 ${item.is_narrative ? "text-sm leading-6 text-[#334155]" : "text-lg font-semibold tracking-tight text-[#1c1c1c]"}`}>
            {value}
          </div>
        </div>
      </div>
    </button>
  );
}

function MetricChangeRow({
  item,
}: {
  item: FilingMetricConfig & { metric: CompanyFilingCompareMetric };
}) {
  const deltaNumber = coerceNumber(item.metric.delta);
  const deltaClass =
    deltaNumber === null ? "text-[#1c1c1c]" : deltaNumber > 0 ? "text-emerald-700" : deltaNumber < 0 ? "text-rose-700" : "text-[#1c1c1c]";

  return (
    <div className="grid grid-cols-[minmax(180px,1.4fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)] gap-4 border-t border-[#eef2f7] bg-white px-4 py-4 text-sm">
      <div className="font-medium text-[#1c1c1c]">{item.label}</div>
      <div className="text-[#334155]">{formatMetricValue(item.metric.left_value, item.formatter)}</div>
      <div className="text-[#334155]">{formatMetricValue(item.metric.right_value, item.formatter)}</div>
      <div className={deltaClass}>
        {formatDelta(item.metric.delta, item.formatter)}
        {item.metric.delta_pct !== null ? (
          <span className="ml-2 text-xs text-[#8c8c8c]">({formatPercent(item.metric.delta_pct)})</span>
        ) : null}
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-[220px] flex-col gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7f8a98]">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[#dbe3ee] bg-white px-4 py-3 text-sm font-medium normal-case tracking-normal text-[#1c1c1c] outline-none transition-colors focus:border-[#9fbbe0] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]"
      >
        {options.map((option) => (
          <option key={`${label}-${option.value || "empty"}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
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

function Badge({ label, tone }: { label: string; tone: "blue" | "slate" }) {
  const classes =
    tone === "blue"
      ? "bg-[#dfedfa] text-[#2f5f9f]"
      : "bg-[#eef2f7] text-[#64748b]";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}>{label}</span>;
}

function formatMetricValue(value: string | number | null | undefined, formatter: FilingMetricFormatter): string {
  if (formatter === "integer") {
    const parsed = coerceNumber(value);
    return formatInteger(parsed === null ? null : Math.trunc(parsed));
  }
  return formatCompactCurrency(value);
}

function formatDelta(value: string | number | null | undefined, formatter: FilingMetricFormatter): string {
  const parsed = coerceNumber(value);
  if (parsed === null) {
    return "—";
  }
  const formatted = formatMetricValue(value, formatter);
  return parsed > 0 ? `+${formatted}` : formatted;
}

function formatPercent(value: number): string {
  const percentage = value * 100;
  return `${percentage > 0 ? "+" : ""}${percentage.toFixed(1)}%`;
}

function formatFilingOptionLabel(item: CompanyFilingItem): string {
  const periodLabel = item.current_period_date ? formatDate(item.current_period_date) : `Document ${item.document_id}`;
  return `${periodLabel} • ${item.source_path}`;
}

function describeDisclosureSection(section: string): string {
  switch (section) {
    case "Director Statements":
      return "Compliance and audit-exemption statements delivered with the filing.";
    case "Note Balances":
      return "Dimensional note balances and maturity splits reported alongside the headline numbers.";
    case "Reporting Context":
      return "Tagged dates and filing context disclosures taken from the selected report.";
    case "People":
      return "Workforce or officer-related disclosures reported in the filing.";
    default:
      return "Additional tagged disclosures captured from the filing.";
  }
}

function getMetricLabel(metricKey: string): string {
  return METRIC_CONFIG_BY_KEY.get(metricKey)?.label ?? formatMetricLabel(metricKey);
}

function getMetricFormatter(metricKey: string): "currency" | "integer" {
  return METRIC_CONFIG_BY_KEY.get(metricKey)?.formatter ?? "currency";
}

function coerceNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
