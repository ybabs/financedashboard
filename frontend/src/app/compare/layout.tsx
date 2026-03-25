"use client";

import { useSearchParams } from "next/navigation";

import { TerminalShell } from "@/components/app/terminal-shell";

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const left = normalizeCompanyNumber(searchParams.get("left"));
  const right = normalizeCompanyNumber(searchParams.get("right"));

  const selectedCount = [left, right].filter(Boolean).length;
  const hasTwoCompanies = Boolean(left && right);
  const sameCompanySelected = hasTwoCompanies && left === right;
  const terminalHref = left ? `/company/${encodeURIComponent(left)}` : "/company/09092149";

  const selectionLabel =
    selectedCount === 0
      ? "Select 2 companies"
      : `${selectedCount} compan${selectedCount === 1 ? "y" : "ies"} selected`;

  const readinessLabel = sameCompanySelected
    ? "Choose different companies"
    : hasTwoCompanies
      ? "Ready"
      : "Awaiting selection";

  const readinessTone = sameCompanySelected ? "default" : hasTwoCompanies ? "success" : "default";

  return (
    <TerminalShell
      title="Company Comparison"
      avatarLabel="CP"
      terminalHref={terminalHref}
      extraTabs={[{ label: "Comparison", href: "/compare", isActive: true }]}
      metaItems={[
        { label: "Side-by-side view" },
        { label: selectionLabel, tone: hasTwoCompanies && !sameCompanySelected ? "accent" : "default" },
        { label: readinessLabel, tone: readinessTone },
      ]}
    >
      {children}
    </TerminalShell>
  );
}

function normalizeCompanyNumber(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return normalized || null;
}
