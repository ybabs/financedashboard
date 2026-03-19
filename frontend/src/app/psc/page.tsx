"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Buildings, ShareNetwork } from "@phosphor-icons/react/dist/ssr";

import { TerminalShell } from "@/components/app/terminal-shell";
import { type PscRelationshipResponse, getPscRelationships } from "@/lib/api";
import { formatDate, initialsFromName } from "@/lib/format";
import {
  buildCompaniesHousePscUrl,
  formatNatureOfControl,
  formatPartialDateOfBirth,
  formatPscKind,
  getPscStatusLabel,
} from "@/lib/psc";

type LoadState = {
  key: string | null;
  payload: PscRelationshipResponse | null;
  error: string | null;
};

export default function PscPage() {
  const searchParams = useSearchParams();
  const companyNumber = (searchParams.get("company") ?? "").trim().toUpperCase();
  const pscKey = (searchParams.get("psc") ?? "").trim();
  const hasSeedParams = Boolean(companyNumber && pscKey);
  const requestKey = hasSeedParams ? `${companyNumber}::${pscKey}` : null;
  const [state, setState] = useState<LoadState>({
    key: null,
    payload: null,
    error: null,
  });

  useEffect(() => {
    if (!hasSeedParams || !requestKey) {
      return;
    }

    let active = true;
    getPscRelationships(companyNumber, pscKey)
      .then((payload) => {
        if (!active) {
          return;
        }
        setState({
          key: requestKey,
          payload,
          error: null,
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setState({
          key: requestKey,
          payload: null,
          error: error instanceof Error ? error.message : "Failed to load PSC relationship view",
        });
      });

    return () => {
      active = false;
    };
  }, [companyNumber, hasSeedParams, pscKey, requestKey]);

  const isMissingSeed = !hasSeedParams;
  const isCurrentPayload = state.key === requestKey;
  const payload = isCurrentPayload ? state.payload : null;
  const error = isMissingSeed
    ? "Missing PSC seed information in the route."
    : isCurrentPayload
      ? state.error
      : null;
  const isLoading = !isMissingSeed && !isCurrentPayload;
  const seed = payload?.seed ?? null;
  const linkedCompanies = payload?.linked_companies ?? [];
  const relatedCompanies = linkedCompanies.filter((item) => !item.is_seed);
  const companiesHouseUrl = buildCompaniesHousePscUrl(seed?.link_self);

  const title = seed?.name ?? "PSC Relationship View";
  const avatarLabel = initialsFromName(seed?.name ?? "PSC");
  const terminalHref = payload?.seed_company_number ? `/company/${payload.seed_company_number}` : "/company/09092149";

  const metaItems = useMemo(
    () => [
      { label: payload?.seed_company_name ? `Seed: ${payload.seed_company_name}` : isLoading ? "Loading seed record" : "Seed not loaded" },
      {
        label:
          payload == null
            ? isLoading
              ? "Resolving links"
              : "Awaiting data"
            : formatCompanyScopeLabel(linkedCompanies.length),
        tone: payload ? "accent" as const : "default" as const,
      },
      {
        label: payload?.linkable ? "Strict match active" : "Seed-only mode",
        tone: payload?.linkable ? "success" as const : "default" as const,
      },
    ],
    [isLoading, linkedCompanies.length, payload],
  );

  return (
    <TerminalShell
      title={title}
      avatarLabel={avatarLabel}
      terminalHref={terminalHref}
      extraTabs={[
        { label: seed?.name ?? "PSC", href: companyNumber && pscKey ? `/psc?company=${encodeURIComponent(companyNumber)}&psc=${encodeURIComponent(pscKey)}` : "/psc", isActive: true },
      ]}
      metaItems={metaItems}
    >
      {isLoading ? (
        <StateCard label="Loading PSC relationship view..." />
      ) : error ? (
        <StateCard label={error} muted />
      ) : payload && seed ? (
        <div className="flex h-full w-full flex-col space-y-6 pb-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <section className="cb-card rounded-3xl p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">PSC identity</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--cb-text-strong)]">{seed.name}</h2>
                  <p className="mt-2 text-sm text-[var(--cb-text-muted)]">{formatPscKind(seed.kind)}</p>
                </div>
                {companiesHouseUrl ? (
                  <a
                    href={companiesHouseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="cb-pill flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:text-[var(--astronaut-700)]"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Open Companies House record
                  </a>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <InfoCard label="Nationality" value={seed.nationality ?? "Unavailable"} />
                <InfoCard label="Country of residence" value={seed.country_of_residence ?? "Unavailable"} />
                <InfoCard label="Date of birth" value={formatPartialDateOfBirth(seed.dob_year, seed.dob_month)} />
                <InfoCard label="Status" value={getPscStatusLabel(seed)} />
                <InfoCard label="Sanctions" value={seed.is_sanctioned ? "Sanctioned" : "No flag"} />
                <InfoCard label="Seed company" value={`${payload.seed_company_name} • Co. ${payload.seed_company_number}`} />
              </div>
            </section>

            <section className="cb-card rounded-3xl p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">Relationship state</p>
              <div className="mt-4 rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] p-4">
                <div className="text-sm font-semibold text-[var(--cb-text-strong)]">
                  {payload.linkable ? "Strict name + DOB matching enabled" : "Seed-only relationship mode"}
                </div>
                <p className="mt-2 text-sm text-[var(--cb-text-muted)]">
                  {payload.linkable
                    ? relatedCompanies.length > 0
                      ? `Found ${relatedCompanies.length} additional linked ${relatedCompanies.length === 1 ? "company" : "companies"} for this PSC.`
                      : "No additional companies met the strict name + DOB matching rule."
                    : "This PSC cannot be linked across companies automatically because name or date-of-birth data is incomplete."}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <ActionLink href={`/company/${payload.seed_company_number}`} icon={<Buildings className="h-4 w-4" />}>
                  Open seed company
                </ActionLink>
                {companiesHouseUrl ? (
                  <ActionLink href={companiesHouseUrl} external icon={<ArrowUpRight className="h-4 w-4" />}>
                    Open Companies House record
                  </ActionLink>
                ) : null}
              </div>
            </section>
          </div>

          <section className="cb-card rounded-3xl p-6">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">Linked companies</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--cb-text-strong)]">Relationship view</h3>
              <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                Linked companies are shown using strict normalized-name and DOB matching.
              </p>
            </div>

            <div className="space-y-3">
              {linkedCompanies.map((item) => (
                <Link
                  key={`${item.company_number}-${item.psc.psc_key}`}
                  href={`/company/${item.company_number}`}
                  className="block rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] p-5 transition-colors hover:border-[var(--astronaut-200)] hover:bg-[color-mix(in_oklab,var(--cb-neutral-0)_80%,var(--astronaut-50))]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-[var(--cb-text-strong)]">{item.company_name}</span>
                        <span className="rounded-full bg-[var(--cb-neutral-1)] px-2 py-0.5 text-[11px] font-semibold text-[var(--cb-text-muted)]">
                          Co. {item.company_number}
                        </span>
                        {item.is_seed ? (
                          <span className="rounded-full bg-[var(--astronaut-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--astronaut-700)]">
                            Seed
                          </span>
                        ) : null}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.psc.ceased ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                          {getPscStatusLabel(item.psc)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-[var(--cb-text-muted)]">
                        {item.company_status ?? "Company status unavailable"}
                        {item.psc.notified_on ? ` • Notified ${formatDate(item.psc.notified_on)}` : ""}
                        {item.psc.ceased_on ? ` • Ceased ${formatDate(item.psc.ceased_on)}` : ""}
                      </div>
                    </div>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[var(--cb-text-subtle)]" />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.psc.natures_of_control.length > 0 ? (
                      item.psc.natures_of_control.map((nature) => (
                        <span
                          key={nature}
                          className="rounded-full bg-[var(--astronaut-50)] px-3 py-1 text-xs font-medium text-[var(--astronaut-700)]"
                        >
                          {formatNatureOfControl(nature)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--cb-text-muted)]">No nature-of-control tags returned.</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {linkedCompanies.length > 0 ? (
            <section className="cb-card rounded-3xl p-6">
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--cb-text-subtle)]">Control network</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--cb-text-strong)]">PSC-to-company graph</h3>
                <p className="mt-1 text-sm text-[var(--cb-text-muted)]">
                  Narrow first-pass graph: one PSC node and every company currently in scope for this relationship view.
                </p>
              </div>
              <ControlNetworkGraph seedName={seed.name} linkedCompanies={linkedCompanies} />
            </section>
          ) : null}
        </div>
      ) : null}
    </TerminalShell>
  );
}

function StateCard({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <div className="cb-card rounded-3xl p-8">
      <p className={`text-sm ${muted ? "text-[var(--cb-text-muted)]" : "text-[var(--cb-text-strong)]"}`}>{label}</p>
    </div>
  );
}

function formatCompanyScopeLabel(count: number): string {
  return `${count} ${count === 1 ? "company" : "companies"} in scope`;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--cb-stroke-soft)] bg-[var(--cb-neutral-0)] p-4">
      <p className="text-xs font-medium text-[var(--cb-text-subtle)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-[var(--cb-text-strong)]">{value}</p>
    </div>
  );
}

function ActionLink({
  href,
  children,
  external = false,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
  icon?: React.ReactNode;
}) {
  const className = "cb-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[var(--cb-text-strong)] transition-colors hover:text-[var(--astronaut-700)]";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {icon}
      {children}
    </Link>
  );
}

function ControlNetworkGraph({
  seedName,
  linkedCompanies,
}: {
  seedName: string;
  linkedCompanies: PscRelationshipResponse["linked_companies"];
}) {
  const width = 760;
  const height = 420;
  const centerX = width / 2;
  const centerY = 300;
  const radius = 190;
  const nodes = linkedCompanies.map((item, index) => {
    const angle = getCompanyNodeAngle(index, linkedCompanies.length);
    return {
      item,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    };
  });

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--cb-stroke-soft)] bg-[linear-gradient(180deg,rgba(240,246,255,0.55),rgba(255,255,255,0.98))] p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[420px] w-full">
        {nodes.map(({ item, x, y }) => (
          <g key={`${item.company_number}-${item.psc.psc_key}`}>
            <line x1={centerX} y1={centerY} x2={x} y2={y} stroke="#c9d7ea" strokeWidth="2" />
            <foreignObject x={x - 100} y={y - 42} width="200" height="84">
              <div className={`h-full rounded-2xl border px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ${item.is_seed ? "border-[#cfe0f6] bg-[#edf4ff]" : "border-[#dbe4f2] bg-white"}`}>
                <div className="text-sm font-semibold text-[#1c1c1c]">{item.company_name}</div>
                <div className="mt-1 text-xs text-[#6b7280]">Co. {item.company_number}</div>
                {item.is_seed ? <div className="mt-2 text-[11px] font-semibold text-[#2f5f9f]">Seed company</div> : null}
              </div>
            </foreignObject>
          </g>
        ))}

        <foreignObject x={centerX - 110} y={centerY - 48} width="220" height="96">
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-[#cfe0f6] bg-[#1c1c1c] px-5 py-4 text-center shadow-[0_20px_40px_rgba(15,23,42,0.18)]">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#edf4ff] text-[#2f5f9f]">
              <ShareNetwork className="h-4 w-4" />
            </div>
            <div className="mt-3 text-sm font-semibold text-white">{seedName}</div>
            <div className="mt-1 text-xs text-white/70">PSC seed node</div>
          </div>
        </foreignObject>
      </svg>
    </div>
  );
}

function getCompanyNodeAngle(index: number, count: number): number {
  if (count <= 1) {
    return -Math.PI / 2;
  }

  const start = (-5 * Math.PI) / 6;
  const end = -Math.PI / 6;
  return start + ((end - start) * index) / (count - 1);
}
