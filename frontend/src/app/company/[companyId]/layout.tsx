"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import { Plus_Jakarta_Sans } from "next/font/google";
import {
    Plus,
    ChartLineUp,
    Scales,
    Buildings,
    FileText,
    Gear,
    Export,
    DotsThreeCircle
} from "@phosphor-icons/react/dist/ssr";

import { CompanySearch } from "@/components/company-search";
import { formatCompactCurrency, formatDate, formatInteger, initialsFromName } from "@/lib/format";
import { CompanyDataProvider, useCompanyData } from "./company-context";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default function CompanyLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ companyId: string }>
}) {
    const resolvedParams = use(params);
    const companyId = resolvedParams.companyId.toUpperCase();

    return (
        <CompanyDataProvider companyId={companyId}>
            <CompanyLayoutInner jakartaClassName={jakarta.className}>{children}</CompanyLayoutInner>
        </CompanyDataProvider>
    );
}

function CompanyLayoutInner({
    children,
    jakartaClassName,
}: {
    children: React.ReactNode;
    jakartaClassName: string;
}) {
    const { companyId, detail, overview, isLoading, error } = useCompanyData();
    const router = useRouter();
    const displayName = detail?.name ?? overview?.name ?? companyId;
    const statusLabel = detail?.status ?? overview?.status ?? "unknown";
    const normalizedStatus = statusLabel.toLowerCase();
    const avatarText = initialsFromName(displayName);
    const turnoverValue = overview?.turnover ?? detail?.turnover;
    const employeesValue = overview?.employees ?? detail?.employees;

    return (
        <div className={`${jakartaClassName} flex h-screen bg-[#f4f6f8] text-[#1c1c1c] overflow-hidden w-full antialiased`}>

            {/* SIDEBAR */}
            <aside className="w-[260px] bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex flex-col shrink-0 z-20">

                {/* LOGO AREA - Replaced with our custom SVG */}
                <div className="h-20 flex items-center px-6 shrink-0">
                    <CapitalBaseLogo className="w-8 h-8 mr-3 drop-shadow-sm" />
                    <span className="font-bold text-lg tracking-tight text-[#1c1c1c]">CapitalBase</span>
                </div>

                {/* SEPARATION & LABEL */}
                <div className="px-6 pt-2 pb-3 shrink-0">
                    <span className="text-[11px] font-bold text-[#a0a0a0] uppercase tracking-wider">Workspace</span>
                </div>

                {/* MAIN NAV */}
                <nav className="flex-1 overflow-y-auto px-4 space-y-1.5 pb-4">
                    <SidebarItem icon={ChartLineUp} label="Terminal" active />
                    <SidebarItem icon={Scales} label="Compare Entities" />
                    <SidebarItem icon={Buildings} label="Portfolios" />
                    <SidebarItem icon={FileText} label="Reports" />
                </nav>

                {/* SETTINGS */}
                <div className="p-4 shrink-0 border-t border-slate-100 bg-white">
                    <SidebarItem icon={Gear} label="Settings" />
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col overflow-hidden relative">

                {/* GLOBAL HEADER */}
                <header className="h-20 px-8 flex items-center justify-between shrink-0">
                    <CompanySearch
                        className="w-[440px]"
                        chromeClassName="h-11 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-all focus-within:ring-2 focus-within:ring-[#5193e0]/20"
                        inputClassName="h-11 w-full rounded-full bg-transparent pl-12 pr-16 text-sm font-medium text-[#1c1c1c] placeholder:text-[#a0a0a0] outline-none"
                        buttonClassName="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[#5193e0] text-white transition-colors hover:bg-[#3d79d3]"
                        placeholder="Search company or PSC..."
                    />

                    <div className="flex items-center space-x-4">
                        <button className="flex items-center px-4 py-2 bg-white rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.03)] text-sm font-semibold text-[#666666] hover:text-[#1c1c1c] transition-colors">
                            <Export weight="bold" className="w-4 h-4 mr-2 text-[#8c8c8c]" />
                            Export Data
                        </button>
                        <div className="w-10 h-10 bg-[#dfedfa] text-[#2f539e] rounded-full flex items-center justify-center font-bold text-sm shadow-sm border border-[#c6e0f7]">
                            JD
                        </div>
                    </div>
                </header>

                {/* FLOATING TABS ROW */}
                <div className="px-8 pb-4 flex items-center space-x-2 shrink-0">
                    <TabPill label={displayName} isActive={true} />
                    <button className="h-9 w-9 bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex items-center justify-center text-[#8c8c8c] hover:text-[#5193e0] transition-colors">
                        <Plus weight="bold" className="w-4 h-4" />
                    </button>
                </div>

                {/* SCROLLING CANVAS */}
                <div className="flex-1 overflow-y-auto px-8 pb-10 flex flex-col">

                    <div className="mb-6 flex justify-between items-end shrink-0">
                        <div className="flex items-center space-x-4">
                            <div className="w-14 h-14 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm border border-indigo-100/50">
                                {avatarText}
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-[#1c1c1c] tracking-tight">
                                    {displayName}
                                </h1>
                                <div className="flex items-center space-x-3 mt-1.5">
                                    <span className="text-[13px] font-medium text-[#666666]">Co. {companyId}</span>
                                    <span className="w-1 h-1 bg-[#d9d9d9] rounded-full"></span>
                                    <span className={`text-[13px] font-bold flex items-center ${normalizedStatus === "active" ? "text-[#16a34a]" : "text-[#d97706]"}`}>
                                        <span className={`w-2 h-2 rounded-full mr-1.5 ${normalizedStatus === "active" ? "bg-[#16a34a] shadow-[0_0_8px_rgba(22,163,74,0.35)]" : "bg-[#d97706]"}`}></span>
                                        {statusLabel}
                                    </span>
                                    {error ? (
                                        <>
                                            <span className="w-1 h-1 bg-[#d9d9d9] rounded-full"></span>
                                            <span className="text-[13px] font-medium text-[#b91c1c]">{error}</span>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <QuickFact
                                label="Accounts"
                                value={detail?.last_accounts_made_up_to ? formatDate(detail.last_accounts_made_up_to) : "—"}
                                onClick={() => router.push(`/company/${encodeURIComponent(companyId)}/filings`)}
                            />
                            {hasValue(turnoverValue) ? (
                                <QuickFact label="Turnover" value={formatCompactCurrency(turnoverValue)} />
                            ) : null}
                            {hasValue(employeesValue) ? (
                                <QuickFact label="Employees" value={formatInteger(typeof employeesValue === "number" ? employeesValue : Number(employeesValue))} />
                            ) : null}
                            <button className="p-2 text-[#8c8c8c] hover:text-[#1c1c1c] hover:bg-white rounded-full transition-colors">
                                <DotsThreeCircle weight="fill" className="w-7 h-7" />
                            </button>
                        </div>
                    </div>

                    <main className="flex-1">
                        {isLoading && !detail && !overview ? (
                            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-10 text-sm text-slate-500">
                                Loading company profile...
                            </div>
                        ) : (
                            children
                        )}
                    </main>

                </div>
            </div>
        </div>
    );
}

// --- SUB-COMPONENTS ---

function SidebarItem({ icon: Icon, label, active = false }: { icon: Icon; label: string; active?: boolean }) {
    return (
        <a href="#"
            className={`flex items-center px-4 py-2.5 rounded-xl text-[14px] transition-all duration-200 ${active
                    ? "bg-[#f4f6f8] text-[#1c1c1c] font-bold"
                    : "text-[#666666] hover:text-[#1c1c1c] hover:bg-[#fafafa] font-semibold"
                }`}
        >
            <Icon weight={active ? "duotone" : "regular"} className={`w-5 h-5 mr-3 ${active ? "text-[#5193e0]" : "text-[#a0a0a0]"}`} />
            {label}
        </a>
    );
}

function TabPill({ label, isActive }: { label: string, isActive: boolean }) {
    return (
        <div className={`h-9 px-4 flex items-center cursor-pointer rounded-full transition-all duration-200 shadow-[0_2px_8px_rgba(0,0,0,0.02)] ${isActive
                ? "bg-white text-[#1c1c1c] ring-1 ring-[#d9d9d9]"
                : "bg-white/60 text-[#8c8c8c] hover:bg-white hover:text-[#1c1c1c]"
            }`}
        >
            <span className={`text-[13px] ${isActive ? "font-bold" : "font-semibold"}`}>{label}</span>
        </div>
    );
}

function QuickFact({
    label,
    value,
    onClick,
}: {
    label: string;
    value: string;
    onClick?: () => void;
}) {
    const classes = onClick
        ? "rounded-2xl bg-white/80 px-4 py-3 text-left shadow-[0_2px_10px_rgba(0,0,0,0.03)] transition-colors hover:bg-white"
        : "rounded-2xl bg-white/80 px-4 py-3 shadow-[0_2px_10px_rgba(0,0,0,0.03)]";

    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={classes}>
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#a0a0a0]">{label}</div>
                <div className="mt-1 text-sm font-semibold text-[#1c1c1c]">{value}</div>
            </button>
        );
    }

    return (
        <div className={classes}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#a0a0a0]">{label}</div>
            <div className="mt-1 text-sm font-semibold text-[#1c1c1c]">{value}</div>
        </div>
    );
}

function hasValue(value: string | number | null | undefined): boolean {
    return value !== null && value !== undefined && value !== "";
}

// --- CUSTOM SVG LOGO ---
function CapitalBaseLogo({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
        >
            <rect width="64" height="64" rx="16" fill="url(#logo-gradient)" />
            <rect x="16" y="34" width="8" height="12" rx="4" fill="#ffffff" opacity="0.6" />
            <rect x="28" y="26" width="8" height="20" rx="4" fill="#ffffff" opacity="0.85" />
            <rect x="40" y="18" width="8" height="28" rx="4" fill="#72b1e8" />
            <defs>
                <linearGradient id="logo-gradient" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#5193e0" />
                    <stop offset="1" stopColor="#1e2d4d" />
                </linearGradient>
            </defs>
        </svg>
    );
}
