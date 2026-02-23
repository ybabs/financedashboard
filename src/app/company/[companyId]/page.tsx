"use client";

import React from "react";
import { ArrowUpRight, ArrowDownRight } from "@phosphor-icons/react/dist/ssr";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";

// --- MOCK DATA ---
const trendData = [
    { year: "2020", profit: 120, assets: 400, cash: 150 },
    { year: "2021", profit: 180, assets: 500, cash: 200 },
    { year: "2022", profit: 150, assets: 550, cash: 180 },
    { year: "2023", profit: 250, assets: 700, cash: 300 },
    { year: "2024", profit: 320, assets: 850, cash: 420 },
];

export default function CompanyDashboardPage() {
    return (
        <div className="flex flex-col h-full w-full space-y-6">

            {/* 2x2 GRID FOR CHARTS */}
            <div className="grid grid-cols-2 gap-6 h-[460px] shrink-0">

                <BentoCard title="Net Profit Trend (£m)">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f0f0f0', strokeWidth: 2 }} />
                            <Line type="monotone" dataKey="profit" stroke="#5193e0" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#5193e0", stroke: "#fff", strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </BentoCard>

                <BentoCard title="Total Assets Growth (£m)">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f0f0f0', strokeWidth: 2 }} />
                            <Line type="monotone" dataKey="assets" stroke="#3365c2" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#3365c2", stroke: "#fff", strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </BentoCard>

                <BentoCard title="Cash Position (£m)">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData}>
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f0f0f0', strokeWidth: 2 }} />
                            <Line type="monotone" dataKey="cash" stroke="#72b1e8" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: "#72b1e8", stroke: "#fff", strokeWidth: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </BentoCard>

                <BentoCard title="Platform Buyability Score" action={<ArrowUpRight className="w-4 h-4" />}>
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                        <div className="absolute w-40 h-40 bg-gradient-to-tr from-[#dfedfa] to-transparent rounded-full opacity-50 blur-2xl"></div>
                        <span className="text-[80px] leading-none font-light text-[#1c1c1c] tracking-tighter relative z-10">84</span>
                        <span className="text-sm text-[#5193e0] font-medium mt-3 px-3 py-1 bg-[#dfedfa] rounded-full flex items-center relative z-10">
                            <ArrowUpRight weight="bold" className="mr-1" /> Prime Target Status
                        </span>
                    </div>
                </BentoCard>
            </div>

            {/* BOTTOM METRICS ROW */}
            <div className="grid grid-cols-5 gap-4 shrink-0 pb-6">
                <MetricCard label="Total Assets" value="£850.2m" trend="+21.4%" positive />
                <MetricCard label="Cash in Bank" value="£420.0m" trend="+40.0%" positive />
                <MetricCard label="Current Ratio" value="1.8x" trend="-0.1x" positive={false} />
                <MetricCard label="Debt to Equity" value="0.45" trend="Stable" neutral />
                <MetricCard label="PSC Stability" value="1,204" subtext="Days unch." neutral />
            </div>

        </div>
    );
}

// --- SUB-COMPONENTS ---

function BentoCard({ title, children, action }: { title: string, children: React.ReactNode, action?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-semibold text-[#1c1c1c] tracking-tight">{title}</h3>
                {action && (
                    <button className="text-[#a0a0a0] hover:text-[#1c1c1c] transition-colors">
                        {action}
                    </button>
                )}
            </div>
            <div className="flex-1 min-h-0 relative z-10">
                {children}
            </div>
        </div>
    );
}

function MetricCard({ label, value, trend, subtext, positive, neutral }: { label: string, value: string, trend?: string, subtext?: string, positive?: boolean, neutral?: boolean }) {
    const trendColor = neutral ? "text-[#8c8c8c]" : positive ? "text-[#10b981]" : "text-[#ef4444]";
    const TrendIcon = neutral ? null : positive ? ArrowUpRight : ArrowDownRight;

    return (
        <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-5 flex flex-col justify-between hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-shadow">
            <span className="text-xs font-medium text-[#8c8c8c]">{label}</span>
            <div className="mt-3 flex items-baseline justify-between">
                <span className="text-2xl font-semibold text-[#1c1c1c] tracking-tight">{value}</span>
                {trend && (
                    <span className={`text-xs font-medium flex items-center ${trendColor}`}>
                        {TrendIcon && <TrendIcon weight="bold" className="mr-0.5" />}
                        {trend}
                    </span>
                )}
                {subtext && (
                    <span className="text-xs font-medium text-[#8c8c8c]">{subtext}</span>
                )}
            </div>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#1c1c1c] text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-white/10">
                <p className="font-semibold text-white/70 mb-1">{label}</p>
                <p className="font-bold text-lg">£{payload[0].value}m</p>
            </div>
        );
    }
    return null;
};