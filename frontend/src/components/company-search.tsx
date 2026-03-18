"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

import { CompanySearchResult, searchCompanies } from "@/lib/api";

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
  placeholder = "Search by entity name or company number...",
}: CompanySearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<{
    query: string;
    results: CompanySearchResult[];
    error: string | null;
  }>({
    query: "",
    results: [],
    error: null,
  });
  const [isOpen, setIsOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const normalized = deferredQuery.trim();
    if (normalized.length < 2) {
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;

    searchCompanies(normalized)
      .then((items) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSearchState({
          query: normalized,
          results: items,
          error: null,
        });
        setIsOpen(true);
      })
      .catch((fetchError) => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setSearchState({
          query: normalized,
          results: [],
          error: fetchError instanceof Error ? fetchError.message : "Search failed",
        });
        setIsOpen(true);
      });
  }, [deferredQuery]);

  const normalizedQuery = deferredQuery.trim();
  const results = normalizedQuery.length >= 2 && searchState.query === normalizedQuery
    ? searchState.results
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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (results[0]) {
      navigateToCompany(results[0].company_number);
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
          aria-label="Open company"
        >
          <ArrowRight weight="bold" className="h-5 w-5" />
        </button>

        {isOpen && (query.trim().length >= 2 || error) ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-30 overflow-hidden rounded-2xl border border-white/10 bg-[#0c1018]/95 shadow-2xl backdrop-blur-xl">
            {isLoading ? (
              <SearchState label="Searching companies..." />
            ) : error ? (
              <SearchState label={error} muted />
            ) : results.length === 0 ? (
              <SearchState label="No matching companies found." muted />
            ) : (
              <ul className="py-2">
                {results.map((item) => (
                  <li key={item.company_number}>
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
