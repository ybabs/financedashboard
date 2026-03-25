"use client";

import { usePathname } from "next/navigation";

import { TerminalShell } from "@/components/app/terminal-shell";

export default function PortfoliosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDetail = pathname !== "/portfolios";

  return (
    <TerminalShell
      title="Portfolio Workspace"
      avatarLabel="PF"
      terminalHref="/company/09092149"
      extraTabs={[{ label: "Portfolios", href: "/portfolios", isActive: pathname.startsWith("/portfolios") }]}
      metaItems={[
        { label: "Workspace lists" },
        { label: isDetail ? "Portfolio detail" : "Portfolio dashboard", tone: "accent" },
        { label: "Monitoring ready", tone: "success" },
      ]}
    >
      {children}
    </TerminalShell>
  );
}
