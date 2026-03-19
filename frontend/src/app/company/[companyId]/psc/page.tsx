"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, FunnelSimple } from "@phosphor-icons/react/dist/ssr";

import { PscItem, getCompanyPsc } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatNatureOfControl, formatPartialDateOfBirth, formatPscKind, getPscStatusLabel, isPscCeased } from "@/lib/psc";
import { useCompanyData } from "../company-context";
import { PscDetailDrawer } from "../psc-detail-drawer";

type FilterKey = "all" | "active" | "ceased" | "sanctioned";

type LoadState = {
  companyId: string;
  items: PscItem[];
  error: string | null;
  loaded: boolean;
};

const FILTER_ORDER: FilterKey[] = ["all", "active", "ceased", "sanctioned"];
const EMPTY_PSC_ITEMS: PscItem[] = [];

export default function CompanyPscPage() {
  const { companyId, overview } = useCompanyData();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedPscKey, setSelectedPscKey] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [state, setState] = useState<LoadState>({
    companyId,
    items: [],
    error: null,
    loaded: false,
  });

  useEffect(() => {
    let active = true;

    getCompanyPsc(companyId, 200)
      .then((payload) => {
        if (!active) {
          return;
        }
        setState({
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
        setState({
          companyId,
          items: [],
          error: error instanceof Error ? error.message : "Failed to load PSC list",
          loaded: true,
        });
      });

    return () => {
      active = false;
    };
  }, [companyId]);

  const isCurrentCompany = state.companyId === companyId;
  const items = isCurrentCompany ? state.items : EMPTY_PSC_ITEMS;
  const error = isCurrentCompany ? state.error : null;
  const isLoading = !isCurrentCompany || !state.loaded;

  const counts = useMemo(
    () => ({
      all: items.length,
      active: items.filter((item) => !isPscCeased(item)).length,
      ceased: items.filter((item) => isPscCeased(item)).length,
      sanctioned: items.filter((item) => Boolean(item.is_sanctioned)).length,
    }),
    [items],
  );

  const visibleItems = useMemo(() => {
    switch (filter) {
      case "active":
        return items.filter((item) => !isPscCeased(item));
      case "ceased":
        return items.filter((item) => isPscCeased(item));
      case "sanctioned":
        return items.filter((item) => Boolean(item.is_sanctioned));
      case "all":
      default:
        return items;
    }
  }, [filter, items]);

  const activePscKey = useMemo(
    () =>
      selectedPscKey && visibleItems.some((item) => item.psc_key === selectedPscKey)
        ? selectedPscKey
        : visibleItems[0]?.psc_key ?? null,
    [selectedPscKey, visibleItems],
  );

  const selectedPsc = useMemo(
    () => visibleItems.find((item) => item.psc_key === activePscKey) ?? null,
    [activePscKey, visibleItems],
  );

  const totalCount = Math.max(overview?.psc_count ?? 0, items.length);

  return (
    <div className="flex h-full w-full flex-col space-y-6 pb-6">
      <PscDetailDrawer
        item={selectedPsc}
        companyNumber={companyId}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      <section className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7f8a98]">
              People with Significant Control
            </h2>
            <p className="mt-1 text-sm text-[#6b7280]">
              Showing {visibleItems.length} of {totalCount} PSC records currently loaded for this company.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTER_ORDER.map((value) => (
              <FilterPill
                key={value}
                label={formatFilterLabel(value)}
                count={counts[value]}
                active={filter === value}
                onClick={() => setFilter(value)}
              />
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          {isLoading ? (
            <EmptyState
              title="Loading PSC list..."
              description="Fetching the full PSC register for this company."
            />
          ) : error ? (
            <EmptyState title="PSC list unavailable" description={error} />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              title="No PSC records in this filter"
              description={`No ${formatFilterLabel(filter).toLowerCase()} PSC entries were returned for this company.`}
            />
          ) : (
            <div className="space-y-3">
              {visibleItems.map((item) => (
                <PscListCard
                  key={item.psc_key}
                  companyId={companyId}
                  item={item}
                  onOpenDetails={(pscKey) => {
                    setSelectedPscKey(pscKey);
                    setIsDrawerOpen(true);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[#cdddf4] bg-[#eef4fb] text-[#2f5f9f]"
          : "border-[#e7edf5] bg-white text-[#5b6674] hover:border-[#d9e3ef] hover:bg-[#f8fbff]"
      }`}
    >
      <FunnelSimple className="h-4 w-4" />
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          active ? "bg-white text-[#2f5f9f]" : "bg-[#f1f5f9] text-[#64748b]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function PscListCard({
  companyId,
  item,
  onOpenDetails,
}: {
  companyId: string;
  item: PscItem;
  onOpenDetails: (pscKey: string) => void;
}) {
  const relationshipHref = `/psc?company=${encodeURIComponent(companyId)}&psc=${encodeURIComponent(item.psc_key)}`;

  return (
    <div className="rounded-2xl border border-[#e8edf4] bg-[#fbfcfe] p-5 transition-colors hover:border-[#d8e4f2] hover:bg-white">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[#1c1c1c]">{item.name}</h3>
            <StatusPill item={item} />
            {item.is_sanctioned ? (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                Sanctioned
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-sm text-[#6b7280]">{formatPscKind(item.kind)}</div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#7a8696]">
            <span>{item.nationality ?? "Nationality unavailable"}</span>
            <span>{item.country_of_residence ?? "Country of residence unavailable"}</span>
            <span>{formatPartialDateOfBirth(item.dob_year, item.dob_month)}</span>
          </div>
          <div className="mt-2 text-sm text-[#7a8696]">
            {item.notified_on ? `Notified ${formatDate(item.notified_on)}` : "Notification date unavailable"}
            {item.ceased_on ? ` • Ceased ${formatDate(item.ceased_on)}` : ""}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            onClick={() => onOpenDetails(item.psc_key)}
            className="inline-flex items-center gap-2 rounded-full border border-[#d8e0ea] bg-white px-4 py-2 text-sm font-medium text-[#1c1c1c] transition-colors hover:border-[#b8c7d9] hover:bg-[#f8fafc]"
          >
            <ArrowRight className="h-4 w-4" />
            Open details
          </button>
          <Link
            href={relationshipHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#1c1c1c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2b2b2b]"
          >
            <ArrowUpRight className="h-4 w-4" />
            Relationship view
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {item.natures_of_control.length > 0 ? (
          item.natures_of_control.map((nature) => (
            <span
              key={nature}
              className="rounded-full bg-[#edf4ff] px-3 py-1 text-xs font-medium text-[#2f5f9f]"
            >
              {formatNatureOfControl(nature)}
            </span>
          ))
        ) : (
          <span className="text-sm text-[#6b7280]">No nature-of-control tags were returned.</span>
        )}
      </div>
    </div>
  );
}

function StatusPill({ item }: { item: PscItem }) {
  const isCeased = isPscCeased(item);
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isCeased ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"
      }`}
    >
      {getPscStatusLabel(item)}
    </span>
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

function formatFilterLabel(value: FilterKey): string {
  switch (value) {
    case "active":
      return "Active";
    case "ceased":
      return "Ceased";
    case "sanctioned":
      return "Sanctioned";
    case "all":
    default:
      return "All";
  }
}
