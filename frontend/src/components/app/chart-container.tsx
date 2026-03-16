"use client";

import { useEffect, useState } from "react";
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn("w-full min-w-0", className)} style={{ height }}>
      {mounted ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          {children}
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}
