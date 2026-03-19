"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Buildings,
  ChartLineUp,
  DotsThreeCircle,
  Export,
  FileText,
  Gear,
  MagnifyingGlass,
  Plus,
  Scales,
  X,
} from "@phosphor-icons/react/dist/ssr";

import { useCompanyTabs } from "@/components/app/company-tabs-provider";
import {
  type EntitySearchCompanyResult,
  type EntitySearchPscResult,
  searchEntities,
} from "@/lib/api";
import { formatPartialDateOfBirth, formatPscKind } from "@/lib/psc";

type SidebarIcon = React.ComponentType<{
  className?: string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
}>;

type ShellTab = {
  label: string;
  href?: string;
  isActive?: boolean;
  kind?: "company" | "static";
  companyNumber?: string;
};

type ShellMetaItem = {
  label: string;
  tone?: "default" | "success" | "accent";
};

export function TerminalShell({
  children,
  title,
  avatarLabel,
  extraTabs = [],
  metaItems,
  terminalHref = "/company/09092149",
}: {
  children: React.ReactNode;
  title: string;
  avatarLabel: string;
  extraTabs?: ShellTab[];
  metaItems: ShellMetaItem[];
  terminalHref?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, upsertTab, closeTab } = useCompanyTabs();

  const [query, setQuery] = useState("");
  const [companyResults, setCompanyResults] = useState<EntitySearchCompanyResult[]>([]);
  const [pscResults, setPscResults] = useState<EntitySearchPscResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const isCompare = pathname.startsWith("/compare");
  const activeCompanyNumber = pathname.startsWith("/company/") ? pathname.split("/")[2]?.toUpperCase() : null;

  const shellTabs = useMemo(() => {
    const companyTabs: ShellTab[] = tabs.map((tab) => ({
      label: tab.name,
      href: `/company/${tab.companyNumber}`,
      isActive: activeCompanyNumber === tab.companyNumber,
      kind: "company",
      companyNumber: tab.companyNumber,
    }));
    return [...companyTabs, ...extraTabs];
  }, [tabs, activeCompanyNumber, extraTabs]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setCompanyResults([]);
      setPscResults([]);
      setSearchError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setSearchError(null);
        const payload = await searchEntities(query, 6);
        if (!cancelled) {
          setCompanyResults(payload.companies ?? []);
          setPscResults(payload.psc ?? []);
          setDropdownOpen(true);
        }
      } catch (error) {
        if (!cancelled) {
          setCompanyResults([]);
          setPscResults([]);
          setSearchError(error instanceof Error ? error.message : "Search failed");
          setDropdownOpen(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openCompany(result: EntitySearchCompanyResult) {
    const companyNumber = result.company_number.trim().toUpperCase();
    upsertTab({
      companyNumber,
      name: result.name.trim() || companyNumber,
    });
    setQuery("");
    setCompanyResults([]);
    setPscResults([]);
    setSearchError(null);
    setDropdownOpen(false);
    router.push(`/company/${companyNumber}`);
  }

  function openPsc(result: EntitySearchPscResult) {
    setQuery("");
    setCompanyResults([]);
    setPscResults([]);
    setSearchError(null);
    setDropdownOpen(false);
    router.push(`/psc?company=${encodeURIComponent(result.company_number)}&psc=${encodeURIComponent(result.psc_key)}`);
  }

  function closeCompanyTab(companyNumber: string) {
    const remainingTabs = tabs.filter((tab) => tab.companyNumber !== companyNumber);
    closeTab(companyNumber);

    if (activeCompanyNumber === companyNumber) {
      if (remainingTabs.length > 0) {
        router.push(`/company/${remainingTabs[remainingTabs.length - 1].companyNumber}`);
      } else {
        router.push("/compare");
      }
    }
  }

  function submitSearch() {
    if (companyResults.length > 0) {
      openCompany(companyResults[0]);
      return;
    }
    if (pscResults.length > 0) {
      openPsc(pscResults[0]);
    }
  }

  return (
    <div className="cb-shell flex h-screen w-full overflow-hidden">
      <aside className="cb-frame hidden h-full w-64 shrink-0 flex-col md:flex">
        <div className="flex h-20 items-center px-6">
          <CapitalBaseLogo className="mr-3 h-8 w-8 drop-shadow-sm" />
          <span className="text-lg font-semibold tracking-tight text-[var(--cb-text-strong)]">CapitalBase</span>
        </div>
        <div className="px-6 pb-3 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">
            Workspace
          </span>
        </div>
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
          <SidebarItem icon={ChartLineUp} label="Terminal" href={terminalHref} active={!isCompare} />
          <SidebarItem icon={Scales} label="Compare Entities" href="/compare" active={isCompare} />
          <SidebarItem icon={Buildings} label="Portfolios" />
          <SidebarItem icon={FileText} label="Reports" />
        </nav>
        <div className="border-t border-[var(--cb-stroke-soft)] p-4">
          <SidebarItem icon={Gear} label="Settings" />
        </div>
      </aside>

      <div className="cb-canvas flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-20 shrink-0 items-center justify-between gap-4 px-4 md:px-8">
          <div ref={searchBoxRef} className="relative w-full max-w-xl">
            <div className="cb-input flex h-11 w-full items-center rounded-full px-4 shadow-[0_8px_20px_rgba(20,35,60,0.05)]">
              <MagnifyingGlass weight="bold" className="mr-3 h-4 w-4 text-[var(--cb-text-subtle)]" />
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => {
                  if (companyResults.length > 0 || pscResults.length > 0 || searchError) {
                    setDropdownOpen(true);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitSearch();
                  }
                }}
                placeholder="Search company or PSC..."
                className="w-full border-none bg-transparent text-sm font-medium outline-none"
              />
            </div>

            {dropdownOpen && (query.trim().length >= 2 || searchError) ? (
              <div className="cb-card absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl">
                {isLoading ? <SearchStateRow label="Searching..." /> : null}
                {!isLoading && searchError ? <SearchStateRow label={searchError} muted /> : null}
                {!isLoading && !searchError && companyResults.length === 0 && pscResults.length === 0 ? (
                  <SearchStateRow label="No companies or PSCs found" muted />
                ) : null}
                {!isLoading && !searchError
                  ? (
                      <>
                        {companyResults.length > 0 ? (
                          <>
                            <SearchSectionLabel label="Companies" />
                            {companyResults.map((result) => (
                              <button
                                key={result.company_number}
                                onClick={() => openCompany(result)}
                                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--cb-neutral-1)]"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-[var(--cb-text-strong)]">{result.name}</p>
                                  <p className="mt-1 text-xs text-[var(--cb-text-muted)]">
                                    Co. {result.company_number}
                                    {result.status ? `  •  ${result.status}` : ""}
                                  </p>
                                </div>
                                <span className="text-xs font-semibold text-[var(--astronaut-700)]">
                                  {typeof result.score === "number" ? result.score.toFixed(2) : ""}
                                </span>
                              </button>
                            ))}
                          </>
                        ) : null}
                        {pscResults.length > 0 ? (
                          <>
                            <SearchSectionLabel label="People with Significant Control" />
                            {pscResults.map((result) => (
                              <button
                                key={`${result.company_number}-${result.psc_key}`}
                                onClick={() => openPsc(result)}
                                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--cb-neutral-1)]"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[var(--cb-text-strong)]">{result.name}</p>
                                  <p className="mt-1 text-xs text-[var(--cb-text-muted)]">
                                    {formatPscKind(result.psc_kind)}
                                    {(result.dob_year || result.dob_month) ? `  •  ${formatPartialDateOfBirth(result.dob_year, result.dob_month)}` : ""}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-[var(--cb-text-subtle)]">
                                    {result.company_name}  •  Co. {result.company_number}
                                  </p>
                                </div>
                                <span className="ml-4 text-xs font-semibold text-[var(--astronaut-700)]">
                                  {result.ceased ? "Ceased" : "Active"}
                                </span>
                              </button>
                            ))}
                          </>
                        ) : null}
                      </>
                    )
                  : null}
              </div>
            ) : null}
          </div>

          <div className="hidden items-center space-x-3 md:flex">
            <button className="cb-pill flex items-center rounded-full px-4 py-2 text-sm font-semibold text-[var(--cb-text-muted)] transition-colors hover:text-[var(--cb-text-strong)]">
              <Export weight="bold" className="mr-2 h-4 w-4 text-[var(--cb-text-subtle)]" />
              Export Data
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--astronaut-200)] bg-[var(--astronaut-100)] text-sm font-bold text-[var(--astronaut-900)]">
              JD
            </div>
          </div>
        </header>

        <div className="flex shrink-0 items-center space-x-2 overflow-x-auto px-4 pb-4 md:px-8">
          {shellTabs.map((tab) => (
            <TabPill
              key={`${tab.kind ?? "static"}-${tab.href ?? tab.label}`}
              label={tab.label}
              isActive={tab.isActive}
              href={tab.href}
              closable={tab.kind === "company"}
              onClose={tab.companyNumber ? () => closeCompanyTab(tab.companyNumber!) : undefined}
            />
          ))}
          <button className="cb-pill flex h-9 w-9 items-center justify-center rounded-full text-[var(--cb-text-subtle)] transition-colors hover:text-[var(--astronaut-700)]">
            <Plus weight="bold" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-10 md:px-8">
          <div className="mb-6 flex items-end justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--astronaut-200)] bg-[var(--astronaut-50)] text-xl font-bold text-[var(--astronaut-900)]">
                {avatarLabel}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{title}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {metaItems.map((item, index) => (
                    <MetaItem key={`${item.label}-${index}`} {...item} />
                  ))}
                </div>
              </div>
            </div>
            <button className="cb-pill rounded-full p-2 text-[var(--cb-text-subtle)] transition-colors hover:text-[var(--cb-text-strong)]">
              <DotsThreeCircle weight="fill" className="h-7 w-7" />
            </button>
          </div>

          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active = false,
  href = "#",
}: {
  icon: SidebarIcon;
  label: string;
  active?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center rounded-xl px-4 py-2.5 text-[14px] font-medium transition-all duration-200 ${
        active
          ? "bg-[var(--cb-neutral-2)] text-[var(--cb-text-strong)]"
          : "text-[var(--cb-text-muted)] hover:bg-[var(--cb-neutral-0)] hover:text-[var(--cb-text-strong)]"
      }`}
    >
      <Icon
        weight={active ? "duotone" : "regular"}
        className={`mr-3 h-5 w-5 ${active ? "text-[var(--astronaut-600)]" : "text-[var(--cb-text-subtle)]"}`}
      />
      {label}
    </Link>
  );
}

function TabPill({
  label,
  isActive = false,
  href = "#",
  closable = false,
  onClose,
}: {
  label: string;
  isActive?: boolean;
  href?: string;
  closable?: boolean;
  onClose?: () => void;
}) {
  return (
    <div
      className={`flex h-9 shrink-0 items-center rounded-full px-1 text-[13px] transition-all duration-200 ${
        isActive ? "cb-pill-active text-[var(--cb-text-strong)]" : "cb-pill text-[var(--cb-text-muted)]"
      }`}
    >
      <Link href={href} className={`px-3 ${isActive ? "font-semibold" : "font-medium"}`}>
        {label}
      </Link>
      {closable ? (
        <button
          onClick={onClose}
          className="mr-1 rounded-full p-0.5 transition-colors hover:bg-[var(--cb-neutral-2)]"
          aria-label={`Close ${label}`}
        >
          <X weight="bold" className="h-3 w-3" />
        </button>
      ) : null}
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

function SearchSectionLabel({ label }: { label: string }) {
  return (
    <div className="px-4 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cb-text-subtle)]">
      {label}
    </div>
  );
}

function MetaItem({ label, tone = "default" }: ShellMetaItem) {
  if (tone === "success") {
    return (
      <span className="flex items-center text-[13px] font-semibold text-[var(--cb-success)]">
        <span className="mr-1.5 h-2 w-2 rounded-full bg-[var(--cb-success)]" />
        {label}
      </span>
    );
  }

  if (tone === "accent") {
    return <span className="text-[13px] font-semibold text-[var(--astronaut-700)]">{label}</span>;
  }

  return <span className="text-[13px] font-medium text-[var(--cb-text-muted)]">{label}</span>;
}

function CapitalBaseLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect width="64" height="64" rx="16" fill="url(#logo-gradient)" />
      <rect x="16" y="34" width="8" height="12" rx="4" fill="#ffffff" opacity="0.6" />
      <rect x="28" y="26" width="8" height="20" rx="4" fill="#ffffff" opacity="0.85" />
      <rect x="40" y="18" width="8" height="28" rx="4" fill="var(--astronaut-400)" />
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--astronaut-500)" />
          <stop offset="1" stopColor="var(--astronaut-950)" />
        </linearGradient>
      </defs>
    </svg>
  );
}
