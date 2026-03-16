"use client";

import React from "react";
import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

export default function GlobalDashboard() {
  return (
    <div className="cb-shell relative flex min-h-screen items-center justify-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-12%] h-[680px] w-[900px] -translate-x-1/2 rounded-full bg-[var(--astronaut-500)] opacity-[0.15] blur-[130px]" />
        <div className="absolute bottom-[-26%] right-[-12%] h-[680px] w-[680px] rounded-full bg-[var(--astronaut-900)] opacity-[0.14] blur-[150px]" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "4rem 4rem",
            maskImage: "radial-gradient(ellipse 62% 66% at 50% 35%, #000 22%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 62% 66% at 50% 35%, #000 22%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-6">
        <div className="group relative mx-auto max-w-3xl">
          <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[var(--astronaut-500)] to-[var(--astronaut-800)] opacity-35 blur-sm transition-opacity duration-300 group-hover:opacity-50" />
          <div
            className="relative flex items-center rounded-2xl border border-[var(--cb-stroke-soft)] p-1 shadow-[0_18px_48px_rgba(15,25,40,0.22)]"
            style={{ background: "color-mix(in oklch, var(--cb-neutral-0) 90%, var(--astronaut-50) 10%)" }}
          >
            <div className="pointer-events-none flex items-center px-5 py-4">
              <MagnifyingGlass weight="bold" className="h-6 w-6 text-[var(--astronaut-500)]" />
            </div>
            <input
              type="text"
              placeholder="Search company number, entity name, director, or SIC..."
              className="w-full bg-transparent py-4 pr-3 text-base font-medium text-[var(--cb-text-strong)] placeholder:text-[var(--cb-text-subtle)] focus:outline-none"
            />
            <div className="flex items-center gap-2 pr-2">
              <button className="rounded-xl bg-[var(--astronaut-600)] p-3 text-white transition-colors hover:bg-[var(--astronaut-700)]">
                <ArrowRight weight="bold" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
