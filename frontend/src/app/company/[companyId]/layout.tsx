"use client";

import { use, useEffect } from "react";

import { useCompanyTabs } from "@/components/app/company-tabs-provider";
import { TerminalShell } from "@/components/app/terminal-shell";

export default function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const resolvedParams = use(params);
  const companyId = resolvedParams.companyId;
  const normalizedCompanyId = (companyId || "09092149").toUpperCase();
  const { getTab, upsertTab } = useCompanyTabs();
  const activeTab = getTab(normalizedCompanyId);

  useEffect(() => {
    if (!activeTab) {
      upsertTab({
        companyNumber: normalizedCompanyId,
        name: normalizedCompanyId,
      });
    }
  }, [normalizedCompanyId, activeTab, upsertTab]);

  const companyName = activeTab?.name ?? `Company ${normalizedCompanyId}`;
  const avatarLabel = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <TerminalShell
      title={companyName}
      avatarLabel={avatarLabel || "CB"}
      terminalHref={`/company/${normalizedCompanyId}`}
      metaItems={[
        { label: `Co. ${normalizedCompanyId}` },
        { label: "United Kingdom", tone: "accent" },
        { label: "Active", tone: "success" },
      ]}
    >
      {children}
    </TerminalShell>
  );
}
