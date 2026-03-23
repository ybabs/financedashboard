"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

import {
  EntitySearchCompanyResult,
  EntitySearchPscResult,
  searchEntities,
} from "@/lib/api";
import { formatPartialDateOfBirth, formatPscKind } from "@/lib/psc";

type CompanySearchProps = {
  className?: string;
  inputClassName?: string;
  chromeClassName?: string;
  buttonClassName?: string;
  placeholder?: string;
};

export function CompanySearch({
  className,
  inputClassName,
  chromeClassName,
  buttonClassName,
  placeholder = "Search by company, number, or PSC...",
}: CompanySearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<{
    query: string;
    companies: EntitySearchCompanyResult[];
    psc: EntitySearchPscResult[];
    error: string | null;
  }>({
    query: "",
    companies: [],
    psc: [],
    error: null,
  });
  const [isOpen, setIsOpen] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      searchEntities(normalized, 6, { signal: controller.signal })
        .then((payload) => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          setSearchState({
            query: normalized,
            companies: payload.companies ?? [],
            psc: payload.psc ?? [],
            error: null,
          });
          setIsOpen(true);
        })
        .catch((fetchError) => {
          if (controller.signal.aborted || requestId !== requestIdRef.current) {
            return;
          }
          setSearchState({
            query: normalized,
            companies: [],
            psc: [],
            error: fetchError instanceof Error ? fetchError.message : "Search failed",
          });
          setIsOpen(true);
        });
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  const normalizedQuery = query.trim();
  const companyResults = normalizedQuery.length >= 2 && searchState.query === normalizedQuery
    ? searchState.companies
    : [];
  const pscResults = normalizedQuery.length >= 2 && searchState.query === normalizedQuery
    ? searchState.psc
    : [];
  const error = normalizedQuery.length >= 2 && searchState.query === normalizedQuery
    ? searchState.error
    : null;
  const isLoading = normalizedQuery.length >= 2 && searchState.query !== normalizedQuery;

  function navigateToCompany(companyNumber: string) {
    setIsOpen(false);
    startTransition(() => {
      router.push(`/company/${companyNumber}`);
    });
  }

  function navigateToPsc(item: EntitySearchPscResult) {
    setIsOpen(false);
    startTransition(() => {
      router.push(`/psc?company=${encodeURIComponent(item.company_number)}&psc=${encodeURIComponent(item.psc_key)}`);
    });
  }

  function navigateToResult(item: EntitySearchCompanyResult | EntitySearchPscResult) {
    if (item.kind === "company") {
      navigateToCompany(item.company_number);
      return;
    }
    navigateToPsc(item);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const firstResult = companyResults[0] ?? pscResults[0];
    if (firstResult) {
      navigateToResult(firstResult);
      return;
    }

    const normalized = query.trim();
    if (!normalized) {
      return;
    }

    if (/^[A-Za-z0-9]+$/.test(normalized)) {
      navigateToCompany(normalized.toUpperCase());
    }
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className={`relative ${chromeClassName ?? ""}`}>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
          <MagnifyingGlass weight="bold" className="h-5 w-5 text-[#72b1e8]" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            if (nextQuery.trim().length < 2) {
              requestIdRef.current += 1;
            }
            setQuery(nextQuery);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={inputClassName}
        />
        <button
          type="submit"
          className={buttonClassName}
          aria-label="Open selected result"
        >
          <ArrowRight weight="bold" className="h-5 w-5" />
        </button>

        {isOpen && (query.trim().length >= 2 || error) ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#0c1018]/95 shadow-2xl backdrop-blur-xl">
            {isLoading ? (
              <SearchState label="Searching companies and PSCs..." />
            ) : error ? (
              <SearchState label={error} muted />
            ) : companyResults.length === 0 && pscResults.length === 0 ? (
              <SearchState label="No matching companies or PSCs found." muted />
            ) : (
              <div className="py-2">
                {companyResults.length > 0 ? (
                  <>
                    <SearchSectionLabel label="Companies" />
                    <ul>
                      {companyResults.map((item) => (
                        <li key={`company-${item.company_number}`}>
                          <button
                            type="button"
                            onClick={() => navigateToCompany(item.company_number)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
                          >
                            <div>
                              <div className="text-sm font-semibold text-white">{item.name}</div>
                              <div className="mt-1 text-xs text-[#9fb0c7]">
                                {item.company_number}
                                {item.status ? ` • ${item.status}` : ""}
                              </div>
                            </div>
                            <div className="text-xs font-medium text-[#72b1e8]">
                              {typeof item.score === "number" ? item.score.toFixed(3) : "—"}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {pscResults.length > 0 ? (
                  <>
                    <SearchSectionLabel label="People with Significant Control" />
                    <ul>
                      {pscResults.map((item) => (
                        <li key={`psc-${item.company_number}-${item.psc_key}`}>
                          <button
                            type="button"
                            onClick={() => navigateToPsc(item)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">{item.name}</div>
                              <div className="mt-1 text-xs text-[#9fb0c7]">
                                {formatPscKind(item.psc_kind)}
                                {(item.dob_year || item.dob_month) ? ` • ${formatPartialDateOfBirth(item.dob_year, item.dob_month)}` : ""}
                              </div>
                              <div className="mt-1 truncate text-xs text-[#7d92ae]">
                                {item.company_name} • Co. {item.company_number}
                              </div>
                            </div>
                            <div className="ml-4 text-right text-[11px] font-medium text-[#72b1e8]">
                              {item.ceased ? "Ceased" : "Active"}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </form>
    </div>
  );
}

function SearchState({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div className={`px-4 py-4 text-sm ${muted ? "text-[#94a3b8]" : "text-white"}`}>
      {label}
    </div>
  );
}

function SearchSectionLabel({ label }: { label: string }) {
  return (
    <div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6c7d95]">
      {label}
    </div>
  );
}
