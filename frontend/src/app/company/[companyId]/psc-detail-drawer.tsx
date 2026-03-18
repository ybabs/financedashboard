"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";

import { PscItem } from "@/lib/api";
import { formatDate } from "@/lib/format";

export function PscDetailDrawer({
    item,
    open,
    onClose,
}: {
    item: PscItem | null;
    open: boolean;
    onClose: () => void;
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

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1c1c1c]/20 backdrop-blur-[2px]">
            <button
                type="button"
                className="flex-1 cursor-default"
                aria-label="Close PSC details"
                onClick={onClose}
            />
            <aside className="flex h-full w-full max-w-[440px] flex-col border-l border-[#e8edf4] bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.12)]">
                <div className="flex items-start justify-between border-b border-[#eef2f7] px-6 py-5">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7f8a98]">PSC Details</div>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1c1c1c]">{item.name}</h2>
                        <p className="mt-2 text-sm text-[#6b7280]">{formatPscKind(item.kind)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-[#8c8c8c] transition-colors hover:bg-[#f4f6f8] hover:text-[#1c1c1c]"
                        aria-label="Close PSC detail drawer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                    <DrawerSection title="Identity">
                        <DrawerRow label="Nationality" value={item.nationality ?? "Unavailable"} />
                        <DrawerRow label="Country of residence" value={item.country_of_residence ?? "Unavailable"} />
                        <DrawerRow label="Date of birth" value={formatPartialDateOfBirth(item.dob_year, item.dob_month)} />
                        <DrawerRow label="Status" value={item.ceased ? "Ceased" : "Active"} />
                        <DrawerRow label="Sanctions" value={item.is_sanctioned ? "Sanctioned" : "No flag"} />
                    </DrawerSection>

                    {item.description ? (
                        <DrawerSection title="Description">
                            <p className="text-sm leading-6 text-[#475569]">{item.description}</p>
                        </DrawerSection>
                    ) : null}

                    <DrawerSection title="Control">
                        <div className="flex flex-wrap gap-2">
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
                                <span className="text-sm text-[#6b7280]">No specific natures of control returned.</span>
                            )}
                        </div>
                    </DrawerSection>

                    <DrawerSection title="Timeline">
                        <DrawerRow label="Notified on" value={item.notified_on ? formatDate(item.notified_on) : "Unavailable"} />
                        <DrawerRow label="Ceased on" value={item.ceased_on ? formatDate(item.ceased_on) : "Not ceased"} />
                        <DrawerRow label="Last updated" value={item.updated_at ? formatDate(item.updated_at) : "Unavailable"} />
                    </DrawerSection>

                    {item.address || item.principal_office_address ? (
                        <DrawerSection title="Addresses">
                            {item.address ? <DrawerStack label="Service address" value={formatAddress(item.address)} /> : null}
                            {item.principal_office_address ? (
                                <DrawerStack
                                    label="Principal office"
                                    value={formatAddress(item.principal_office_address)}
                                />
                            ) : null}
                        </DrawerSection>
                    ) : null}

                    {item.identification || item.identity_verification ? (
                        <DrawerSection title="Identification">
                            {item.identification ? (
                                <DrawerStack label="Identification" value={formatKeyValue(item.identification)} />
                            ) : null}
                            {item.identity_verification ? (
                                <DrawerStack
                                    label="Identity verification"
                                    value={formatKeyValue(item.identity_verification)}
                                />
                            ) : null}
                        </DrawerSection>
                    ) : null}

                    {/* TODO: replace hidden raw API links with a user-facing "Open Companies House record" action. */}

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

function formatPscKind(kind: string): string {
    return kind
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatNatureOfControl(value: string): string {
    return value
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatPartialDateOfBirth(year?: number | null, month?: number | null): string {
    if (!year) {
        return "Unavailable";
    }
    if (!month || month < 1 || month > 12) {
        return String(year);
    }
    const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleString("en-GB", {
        month: "long",
        timeZone: "UTC",
    });
    return `${monthLabel} ${year}`;
}

function formatAddress(address: Record<string, unknown>): string {
    const values = Object.values(address)
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean);
    return values.length > 0 ? values.join("\n") : "Unavailable";
}

function formatKeyValue(payload: Record<string, unknown>): string {
    const entries = Object.entries(payload)
        .map(([key, value]) => {
            if (value == null) {
                return null;
            }
            const formattedKey = key
                .replace(/_/g, " ")
                .replace(/\b\w/g, (match) => match.toUpperCase());
            const formattedValue =
                typeof value === "string"
                    ? value
                    : Array.isArray(value)
                      ? value.join(", ")
                      : JSON.stringify(value);
            return `${formattedKey}: ${formattedValue}`;
        })
        .filter((entry): entry is string => Boolean(entry));
    return entries.length > 0 ? entries.join("\n") : "Unavailable";
}
