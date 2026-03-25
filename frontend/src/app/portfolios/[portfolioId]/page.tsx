"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  MagnifyingGlass,
  Trash,
} from "@phosphor-icons/react/dist/ssr";

import {
  addWorkspaceListItem,
  deleteWorkspaceListItem,
  getCompanyOverview,
  getWorkspaceListItems,
  getWorkspaceLists,
  searchCompanies,
  type CompanyOverviewResponse,
  type CompanySearchResult,
  type WorkspaceListItemResponse,
  type WorkspaceListResponse,
} from "@/lib/api";
import {
  formatCompactCurrency,
  formatDate,
  formatInteger,
  formatRatio,
} from "@/lib/format";

type PortfolioState = {
  list: WorkspaceListResponse | null;
  items: WorkspaceListItemResponse[];
  overviews: Record<string, CompanyOverviewResponse | null>;
  loading: boolean;
  error: string | null;
};

export default function PortfolioDetailPage() {
  const params = useParams<{ portfolioId: string }>();
  const searchParams = useSearchParams();
  const portfolioId = Number(params.portfolioId);
  const addedCompany = normalizeCompanyNumber(searchParams.get("added"));
  const createdPortfolio = searchParams.get("created") === "1";

  const [portfolioState, setPortfolioState] = useState<PortfolioState>({
    list: null,
    items: [],
    overviews: {},
    loading: true,
    error: null,
  });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addBusyCompany, setAddBusyCompany] = useState<string | null>(null);
  const [removeBusyCompany, setRemoveBusyCompany] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPortfolio() {
      if (!Number.isFinite(portfolioId)) {
        setPortfolioState({
          list: null,
          items: [],
          overviews: {},
          loading: false,
          error: "Invalid portfolio identifier",
        });
        return;
      }

      try {
        setPortfolioState((current) => ({ ...current, loading: true, error: null }));
        const [listsPayload, itemsPayload] = await Promise.all([
          getWorkspaceLists(200),
          getWorkspaceListItems(portfolioId, 500),
        ]);

        if (!active) {
          return;
        }

        const selectedList = (listsPayload.items ?? []).find((item) => item.id === portfolioId) ?? null;
        if (!selectedList) {
          setPortfolioState({
            list: null,
            items: [],
            overviews: {},
            loading: false,
            error: "Portfolio not found",
          });
          return;
        }

        const items = [...(itemsPayload.items ?? [])].sort((left, right) => right.added_at.localeCompare(left.added_at));
        const overviewResults = await Promise.allSettled(
          items.map((item) => getCompanyOverview(item.company_number)),
        );

        if (!active) {
          return;
        }

        const overviews = items.reduce<Record<string, CompanyOverviewResponse | null>>((accumulator, item, index) => {
          const result = overviewResults[index];
          accumulator[item.company_number] =
            result && result.status === "fulfilled" ? result.value : null;
          return accumulator;
        }, {});

        setPortfolioState({
          list: selectedList,
          items,
          overviews,
          loading: false,
          error: null,
        });
      } catch (loadError) {
        if (!active) {
          return;
        }
        setPortfolioState({
          list: null,
          items: [],
          overviews: {},
          loading: false,
          error: loadError instanceof Error ? loadError.message : "Failed to load portfolio",
        });
      }
    }

    loadPortfolio();
    return () => {
      active = false;
    };
  }, [portfolioId]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || !Number.isFinite(portfolioId)) {
      setResults([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      try {
        setSearchLoading(true);
        setSearchError(null);
        const payload = await searchCompanies(trimmed, 6);
        if (!active) {
          return;
        }
        const existingCompanies = new Set(portfolioState.items.map((item) => item.company_number));
        setResults(payload.filter((item) => !existingCompanies.has(item.company_number)));
      } catch (loadError) {
        if (!active) {
          return;
        }
        setResults([]);
        setSearchError(loadError instanceof Error ? loadError.message : "Search failed");
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [portfolioId, portfolioState.items, query]);

  const overviews = portfolioState.overviews;
  const activeCount = useMemo(
    () =>
      portfolioState.items.reduce((count, item) => {
        const status = overviews[item.company_number]?.status?.toLowerCase() ?? "";
        return status.includes("active") ? count + 1 : count;
      }, 0),
    [overviews, portfolioState.items],
  );
  const latestFinancialPeriod = useMemo(
    () =>
      portfolioState.items.reduce<string | null>((latest, item) => {
        const overview = overviews[item.company_number];
        const period =
          overview?.financial_recency?.effective_accounts_made_up_to ??
          overview?.last_accounts_made_up_to ??
          null;
        if (!period) {
          return latest;
        }
        if (!latest) {
          return period;
        }
        return period > latest ? period : latest;
      }, null),
    [overviews, portfolioState.items],
  );

  async function reloadPortfolio() {
    setPortfolioState((current) => ({ ...current, loading: true }));
    try {
      const [listsPayload, itemsPayload] = await Promise.all([
        getWorkspaceLists(200),
        getWorkspaceListItems(portfolioId, 500),
      ]);
      const selectedList = (listsPayload.items ?? []).find((item) => item.id === portfolioId) ?? null;
      if (!selectedList) {
        setPortfolioState({
          list: null,
          items: [],
          overviews: {},
          loading: false,
          error: "Portfolio not found",
        });
        return;
      }

      const items = [...(itemsPayload.items ?? [])].sort((left, right) => right.added_at.localeCompare(left.added_at));
      const overviewResults = await Promise.allSettled(items.map((item) => getCompanyOverview(item.company_number)));
      const nextOverviews = items.reduce<Record<string, CompanyOverviewResponse | null>>((accumulator, item, index) => {
        const result = overviewResults[index];
        accumulator[item.company_number] =
          result && result.status === "fulfilled" ? result.value : null;
        return accumulator;
      }, {});

      setPortfolioState({
        list: selectedList,
        items,
        overviews: nextOverviews,
        loading: false,
        error: null,
      });
    } catch (reloadError) {
      setPortfolioState((current) => ({
        ...current,
        loading: false,
        error: reloadError instanceof Error ? reloadError.message : "Failed to refresh portfolio",
      }));
    }
  }

  async function handleAddCompany(result: CompanySearchResult) {
    try {
      setAddBusyCompany(result.company_number);
      setActionError(null);
      await addWorkspaceListItem(portfolioId, result.company_number);
      setQuery("");
      setResults([]);
      await reloadPortfolio();
    } catch (addError) {
      setActionError(addError instanceof Error ? addError.message : "Failed to add company");
    } finally {
      setAddBusyCompany(null);
    }
  }

  async function handleRemoveCompany(companyNumber: string) {
    try {
      setRemoveBusyCompany(companyNumber);
      setActionError(null);
      await deleteWorkspaceListItem(portfolioId, companyNumber);
      await reloadPortfolio();
    } catch (removeError) {
      setActionError(removeError instanceof Error ? removeError.message : "Failed to remove company");
    } finally {
      setRemoveBusyCompany(null);
    }
  }

  return (
    <div className="flex h-full w-full flex-col space-y-6 pb-6">
      <section className="cb-card rounded-3xl p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href="/portfolios"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--cb-text-subtle)] transition-colors hover:text-[var(--cb-text-strong)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to portfolios
            </Link>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">
              {portfolioState.list?.name ?? "Portfolio detail"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--cb-text-muted)]">
              Review the companies in this workspace, add more entities from search, and jump back into company analysis
              from one monitoring table.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-4 text-sm text-[var(--cb-text-muted)]">
            {portfolioState.list ? `Updated ${formatDate(portfolioState.list.updated_at)}` : "Loading portfolio"}
          </div>
        </div>
      </section>

      {createdPortfolio ? (
        <div className="rounded-2xl border border-[var(--astronaut-200)] bg-[var(--astronaut-50)] px-4 py-4 text-sm text-[var(--cb-text-strong)]">
          Portfolio created. Add more companies or open one from the monitoring table below.
        </div>
      ) : null}

      {addedCompany ? (
        <div className="rounded-2xl border border-[var(--astronaut-200)] bg-[var(--astronaut-50)] px-4 py-4 text-sm text-[var(--cb-text-strong)]">
          Added <span className="font-semibold">{addedCompany}</span> to this portfolio.
        </div>
      ) : null}

      {portfolioState.loading ? (
        <div className="rounded-3xl border border-dashed border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-10 text-center text-sm text-[var(--cb-text-muted)]">
          Loading portfolio detail...
        </div>
      ) : portfolioState.error ? (
        <div className="rounded-3xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-10 text-center text-sm text-[var(--cb-text-muted)]">
          {portfolioState.error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="Companies tracked"
              value={formatInteger(portfolioState.items.length)}
              hint="Current portfolio size"
            />
            <SummaryCard
              label="Active entities"
              value={formatInteger(activeCount)}
              hint="Based on latest company status"
            />
            <SummaryCard
              label="Latest financial period"
              value={latestFinancialPeriod ? formatDate(latestFinancialPeriod) : "—"}
              hint="Newest effective accounts date in the portfolio"
            />
            <SummaryCard
              label="Portfolio created"
              value={portfolioState.list ? formatDate(portfolioState.list.created_at) : "—"}
              hint="Workspace list creation date"
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
            <section className="cb-card rounded-3xl p-6">
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">Add company</h3>
                <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                  Search by company name or number to add another entity into this monitoring workspace.
                </p>
              </div>

              <div className="mt-5 rounded-full border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-3">
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

              {actionError ? (
                <div className="mt-4 rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-3 text-sm text-[var(--cb-text-muted)]">
                  {actionError}
                </div>
              ) : null}

              {query.trim().length >= 2 ? (
                <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)]">
                  {searchLoading ? (
                    <SearchStateRow label="Searching companies..." />
                  ) : searchError ? (
                    <SearchStateRow label={searchError} muted />
                  ) : results.length ? (
                    results.map((result) => (
                      <button
                        key={result.company_number}
                        type="button"
                        onClick={() => handleAddCompany(result)}
                        disabled={addBusyCompany === result.company_number}
                        className="flex w-full items-center justify-between gap-4 border-t border-[var(--cb-stroke-soft)] px-4 py-3 text-left first:border-t-0 transition-colors hover:bg-[var(--cb-neutral-1)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--cb-text-strong)]">{result.name}</div>
                          <div className="mt-1 text-xs text-[var(--cb-text-muted)]">
                            Co. {result.company_number}
                            {result.status ? ` • ${result.status}` : ""}
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-[var(--astronaut-700)]">
                          {addBusyCompany === result.company_number ? "Adding..." : "Add"}
                        </span>
                      </button>
                    ))
                  ) : (
                    <SearchStateRow label="No matching companies found" muted />
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-8 text-center text-sm text-[var(--cb-text-muted)]">
                  Search for a company to add it to this portfolio.
                </div>
              )}
            </section>

            <section className="cb-card rounded-3xl p-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">Portfolio companies</h3>
                <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                  Compact monitoring view across the entities currently in this portfolio.
                </p>
              </div>

              {portfolioState.items.length ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--cb-stroke-soft)]">
                  <div className="grid grid-cols-[minmax(200px,1.6fr)_minmax(110px,0.8fr)_minmax(110px,0.9fr)_minmax(120px,0.9fr)_minmax(110px,0.8fr)_minmax(140px,1fr)] gap-4 bg-[var(--cb-neutral-1)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
                    <div>Company</div>
                    <div>Status</div>
                    <div>Financial period</div>
                    <div>Net assets</div>
                    <div>Current ratio</div>
                    <div>Added</div>
                  </div>

                  {portfolioState.items.map((item) => {
                    const overview = overviews[item.company_number];
                    const effectiveDate =
                      overview?.financial_recency?.effective_accounts_made_up_to ??
                      overview?.last_accounts_made_up_to ??
                      null;

                    return (
                      <div key={`${item.list_id}:${item.company_number}`} className="border-t border-[var(--cb-stroke-soft)] px-4 py-4">
                        <div className="grid grid-cols-[minmax(200px,1.6fr)_minmax(110px,0.8fr)_minmax(110px,0.9fr)_minmax(120px,0.9fr)_minmax(110px,0.8fr)_minmax(140px,1fr)] gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--cb-text-strong)]">
                              {overview?.name ?? item.company_number}
                            </div>
                            <div className="mt-1 text-xs text-[var(--cb-text-muted)]">Co. {item.company_number}</div>
                            <div className="mt-3 flex flex-wrap gap-3">
                              <Link
                                href={`/company/${item.company_number}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--astronaut-700)]"
                              >
                                <ArrowSquareOut className="h-3.5 w-3.5" />
                                Open company
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleRemoveCompany(item.company_number)}
                                disabled={removeBusyCompany === item.company_number}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--cb-text-subtle)] transition-colors hover:text-[var(--cb-text-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash className="h-3.5 w-3.5" />
                                {removeBusyCompany === item.company_number ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          </div>
                          <div className="text-sm text-[var(--cb-text-strong)]">{overview?.status ?? "—"}</div>
                          <div className="text-sm text-[var(--cb-text-strong)]">{effectiveDate ? formatDate(effectiveDate) : "—"}</div>
                          <div className="text-sm font-semibold text-[var(--cb-text-strong)]">
                            {formatCompactCurrency(overview?.net_assets)}
                          </div>
                          <div className="text-sm font-semibold text-[var(--cb-text-strong)]">
                            {formatRatio(overview?.current_ratio)}
                          </div>
                          <div className="text-sm text-[var(--cb-text-muted)]">{formatDate(item.added_at)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-1)] px-4 py-10 text-center">
                  <div className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">No companies yet</div>
                  <div className="mt-2 text-sm text-[var(--cb-text-muted)]">
                    Use the search panel to add the first company into this portfolio.
                  </div>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--cb-text-muted)]">{hint}</div>
    </div>
  );
}

function SearchStateRow({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div className={`px-4 py-3 text-sm ${muted ? "text-[var(--cb-text-muted)]" : "text-[var(--cb-text-strong)]"}`}>
      {label}
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
