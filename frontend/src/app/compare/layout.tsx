"use client";

import { TerminalShell } from "@/components/app/terminal-shell";

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return (
    <TerminalShell
      title="Company Comparison"
      avatarLabel="CP"
      terminalHref="/company/09092149"
      extraTabs={[
        { label: "Comparison", href: "/compare", isActive: true },
      ]}
      metaItems={[
        { label: "Side-by-side view" },
        { label: "2 companies selected", tone: "accent" },
        { label: "Ready", tone: "success" },
      ]}
    >
      {children}
    </TerminalShell>
  );
}
