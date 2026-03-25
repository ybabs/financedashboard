"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";

import { CompanyFilingItem, CompanyOfficerItem } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatOfficerName, formatOfficerRole } from "@/lib/officers";

export function OfficerDetailDrawer({
  item,
  sourceFiling,
  open,
  onClose,
  onOpenFilingHistory,
}: {
  item: CompanyOfficerItem | null;
  sourceFiling: CompanyFilingItem | null;
  open: boolean;
  onClose: () => void;
  onOpenFilingHistory: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open || !item) {
    return null;
  }

  const filingDate =
    sourceFiling?.current_period_date ??
    sourceFiling?.period_instant ??
    sourceFiling?.period_end ??
    item.reported_period_date ??
    null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#1c1c1c]/20 backdrop-blur-[2px]">
      <button
        type="button"
        className="flex-1 cursor-default"
        aria-label="Close officer details"
        onClick={onClose}
      />
      <aside className="flex h-full w-full max-w-[440px] flex-col border-l border-[#e8edf4] bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.12)]">
        <div className="flex items-start justify-between border-b border-[#eef2f7] px-6 py-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">Director or Officer</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1c1c1c]">{formatOfficerName(item.name)}</h2>
            <p className="mt-2 text-sm text-[#6b7280]">{formatOfficerRole(item.role)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#8c8c8c] transition-colors hover:bg-[#f4f6f8] hover:text-[#1c1c1c]"
            aria-label="Close officer detail drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenFilingHistory();
              }}
              className="inline-flex items-center rounded-full bg-[#1c1c1c] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2b2b2b]"
            >
              Open filing history
            </button>
          </div>

          <DrawerSection title="Reported Source">
            <DrawerRow label="Coverage" value="Latest ingested filing" />
            <DrawerRow label="Role" value={formatOfficerRole(item.role)} />
            <DrawerRow label="Reported as of" value={filingDate ? formatDate(filingDate) : "Unavailable"} />
          </DrawerSection>

          <DrawerSection title="Filing">
            <DrawerRow label="Document ID" value={String(item.source_document_id)} />
            <DrawerStack label="Source file" value={item.source_path} />
          </DrawerSection>

          <DrawerSection title="Notes">
            <p className="text-sm leading-6 text-[#475569]">
              This section is sourced from director and officer names reported in the latest ingested iXBRL filing.
              It is not yet a live Companies House officer register view.
            </p>
          </DrawerSection>
        </div>
      </aside>
    </div>
  );
}

function DrawerSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">{title}</h3>
      <div className="rounded-2xl bg-[#f8fafc] px-4 py-4">{children}</div>
    </section>
  );
}

function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="text-sm text-[#6b7280]">{label}</div>
      <div className="text-right text-sm font-medium text-[#1c1c1c]">{value}</div>
    </div>
  );
}

function DrawerStack({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2">
      <div className="text-sm text-[#6b7280]">{label}</div>
      <div className="mt-2 whitespace-pre-line text-sm font-medium leading-6 text-[#1c1c1c]">{value}</div>
    </div>
  );
}
