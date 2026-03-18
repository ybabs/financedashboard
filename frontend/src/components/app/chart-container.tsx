"use client";

import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

export function ChartContainer({
  children,
  height,
  className,
}: {
  children: React.ReactNode;
  height: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full min-w-0", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
